import type {
  ImportTemplate,
  WarehouseImportScope,
} from '@skladburg/contracts/import/v1/import';

import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { getMethodAccess } from '@skladburg/contracts/runtime';
import { WarehouseStockService } from '@skladburg/contracts/wms/v1/stock';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';

import type { PermissionCallerValue } from '../../access/index';
import type { IDomainErrors } from '../../errors/index';
import type { IStateReader } from '../../state/index';

import { isWarehouseInScope } from '../../access/index';
import {
  CELLS_IMPORT_TEMPLATE,
  OPENING_STOCK_TEMPLATE_ID,
  STOCK_IMPORT_TEMPLATE,
  WAREHOUSE_CELLS_TEMPLATE_ID,
} from './warehouseImportTemplates';

export const getWarehouseImportTemplate = (scope: WarehouseImportScope, errors: IDomainErrors): ImportTemplate => {
  if (scope.templateId === WAREHOUSE_CELLS_TEMPLATE_ID) {
    return CELLS_IMPORT_TEMPLATE;
  }
  if (scope.templateId === OPENING_STOCK_TEMPLATE_ID) {
    return STOCK_IMPORT_TEMPLATE;
  }
  throw errors.internal();
};

export const requireWarehouseImportAccess = (
  reader: IStateReader,
  errors: IDomainErrors,
  caller: PermissionCallerValue,
  scope: WarehouseImportScope,
  isWrite: boolean,
): void => {
  const { templateId, warehouseId } = scope;
  const isCells = templateId === WAREHOUSE_CELLS_TEMPLATE_ID;
  const method = isCells
    ? (isWrite ? WarehouseTopologyService.method.addWarehouseCells : WarehouseTopologyService.method.getWarehouseTopology)
    : (isWrite ? WarehouseStockService.method.postOpeningStock : WarehouseStockService.method.listStockBalances);
  const requirement = getMethodAccess(method)?.requirement;

  if (requirement?.case !== 'permission' || requirement.value.scopeField !== 'warehouse_id') {
    throw errors.internal();
  }

  const permission = requirement.value.name;
  if (caller.admission.kind !== 'membership') {
    throw errors.permissionDenied(permission, warehouseId);
  }

  const grant = caller.permissions.find(candidate => candidate.permission === permission);
  if (grant === undefined || !isWarehouseInScope(grant, warehouseId)) {
    throw errors.permissionDenied(permission, warehouseId);
  }

  if (reader.get('warehouses', warehouseId)?.tenantId !== caller.organizationId) {
    throw errors.notFound(EntityKind.WAREHOUSE);
  }
};
