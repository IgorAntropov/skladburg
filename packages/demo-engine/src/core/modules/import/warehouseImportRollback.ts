import type { WarehouseImportScope } from '@skladburg/contracts/import/v1/import';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import {
  ErrorCode,
  ImportRollbackBlockedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import { ImportStatus } from '@skladburg/contracts/import/v1/import';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { ImportRecordValue } from './importRecords';

import { readStockMovement } from '../wms/stockRecords';
import { assertWarehouseLayoutZonesAvailable } from '../wms/warehouseLayoutSessions';
import { readWarehouseTopology } from '../wms/warehouseTopologyCodec';
import {
  readOwnedWarehouseTopology,
  saveWarehouseTopology,
} from '../wms/warehouseTopologyRecords';
import { WAREHOUSE_CELLS_TEMPLATE_ID } from './warehouseImportTemplates';

export { requireWarehouseImportAccess } from './warehouseImportAccess';

const findRollbackZoneIds = (topology: WarehouseTopology, cellIds: ReadonlySet<string>): Set<string> | undefined => {
  const remaining = new Set(cellIds);
  const zones = new Set<string>();

  for (const zone of topology.storageZones) {
    for (const row of zone.rows) {
      for (const rack of row.racks) {
        for (const tier of rack.tiers) {
          for (const cell of tier.cells) {
            if (cellIds.has(cell.id)) {
              if (!remaining.delete(cell.id)) {
                return undefined;
              }
              zones.add(zone.id);
            }
          }
        }
      }
    }
  }

  return remaining.size === 0 ? zones : undefined;
};

export const rollbackWarehouseImport = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  scope: WarehouseImportScope,
  record: ImportRecordValue,
): void => {
  const { errors } = runtime;
  const { tenantId } = record.job;
  const { warehouseId } = scope;
  const rollback = record.warehouseImport?.rollback;
  const topology = readOwnedWarehouseTopology(transaction, errors, warehouseId, tenantId);
  const blocked = (): never => {
    throw errors.create(ErrorCode.IMPORT_ROLLBACK_BLOCKED, {
      case: 'importRollbackBlocked', value: create(ImportRollbackBlockedParamsSchema, { jobId: record.id }),
    });
  };
  if (scope.templateId !== WAREHOUSE_CELLS_TEMPLATE_ID || rollback == null || topology?.revision !== rollback.revision) {
    return blocked();
  }

  const ids = new Set(rollback.addedCellIds);
  if (ids.size === 0 || ids.size !== rollback.addedCellIds.length || ids.size !== record.rows.length) {
    return blocked();
  }
  const zoneIds = findRollbackZoneIds(topology, ids);
  if (zoneIds === undefined) {
    return blocked();
  }
  const hasMovements = transaction.listBy('stockMovements', 'scopeId', warehouseId).some((entry) => {
    const movement = readStockMovement(entry, tenantId, errors);
    return ids.has(movement.toCellId) || (movement.fromCellId !== undefined && ids.has(movement.fromCellId));
  });
  if (hasMovements || topology.revision >= 2_147_483_647) {
    return blocked();
  }

  const restored = rollback.previousTopologyBytes === null
    ? create(WarehouseTopologySchema, { tenantId, warehouseId })
    : readWarehouseTopology({ id: warehouseId, topologyBytes: rollback.previousTopologyBytes });
  if (restored.tenantId !== tenantId || restored.warehouseId !== warehouseId) {
    throw errors.internal();
  }
  assertWarehouseLayoutZonesAvailable(transaction, runtime, { tenantId, warehouseId, zoneIds });
  restored.revision = topology.revision + 1;
  saveWarehouseTopology(transaction, runtime, restored);
  record.job.status = ImportStatus.ROLLED_BACK;
};
