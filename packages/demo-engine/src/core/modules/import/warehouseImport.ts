import type {
  ImportRow,
  WarehouseImportScope,
} from '@skladburg/contracts/import/v1/import';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  ImportRollbackBlockedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import { ImportStatus } from '@skladburg/contracts/import/v1/import';
import { PostOpeningStockRequestSchema } from '@skladburg/contracts/wms/v1/stock';
import {
  WarehouseCellInputSchema,
  WarehouseTopologySchema,
} from '@skladburg/contracts/wms/v1/topology';

import type { PermissionCallerValue } from '../../access/index';
import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { IRequestValidator } from '../../validation/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { ImportRecordValue } from './importRecords';
import type {
  WarehouseCellRollbackValue,
  WarehouseImportMetadataValue,
} from './warehouseImportMetadata';
import type { WarehouseXlsxCellValue } from './xlsxReader';

import {
  applyOpeningStockPlan,
  planOpeningStock,
} from '../wms/openingStockPlan';
import { readStockMovement } from '../wms/stockRecords';
import { planWarehouseCells } from '../wms/warehouseCellPlan';
import {
  readOwnedWarehouseTopology,
  saveWarehouseTopology,
} from '../wms/warehouseTopologyRecords';
import { readImportColumns } from './importRowMapping';
import { getWarehouseImportTemplate } from './warehouseImportAccess';
import {
  addWarehouseRowError,
  mapWarehouseCellRows,
  mapWarehouseRows,
} from './warehouseImportRows';
import { mapWarehouseStockRows } from './warehouseImportStockRows';
import { WAREHOUSE_CELLS_TEMPLATE_ID } from './warehouseImportTemplates';

export {
  getWarehouseImportTemplate,
  requireWarehouseImportAccess,
} from './warehouseImportAccess';

interface WarehouseImportInputValue {
  caller: PermissionCallerValue;
  columns: readonly string[];
  jobId: string;
  rows: readonly ImportRow[];
  scope: WarehouseImportScope;
  validator: IRequestValidator;
}

interface WarehouseImportPlanValue {
  apply: (transaction: IStateTransaction) => null | WarehouseCellRollbackValue;
  metadata: WarehouseImportMetadataValue;
}

interface WarehousePreviewValue {
  columns: string[];
  metadata: WarehouseImportMetadataValue;
  rows: ImportRow[];
}

const cellField = (path: string): string => {
  switch (path) {
    case 'rack_footprint.depth_mm': return 'rack_depth_mm';
    case 'rack_footprint.origin.x_mm': return 'rack_x_mm';
    case 'rack_footprint.origin.z_mm': return 'rack_z_mm';
    case 'rack_footprint.width_mm': return 'rack_width_mm';
    default: return path;
  }
};

const stockIssue = (path: string): { field: string; line: number | undefined } => {
  const match = /^lines\[([0-9]+)\](?:\.(.+))?$/u.exec(path);
  const field = match?.[2] ?? path;
  return {
    field: field === 'cell_id' ? 'cell_code' : field === 'product_id' ? 'sku' : field.split('.')[0] ?? field,
    line: match === null ? undefined : Number(match[1]),
  };
};

const prepareWarehouseImport = (
  reader: IStateReader,
  runtime: IModuleRuntime,
  input: WarehouseImportInputValue,
): WarehouseImportPlanValue => {
  const { caller, columns, jobId, rows, scope, validator } = input;
  const { errors } = runtime;
  const { warehouseId } = scope;
  const { organizationId } = caller;
  const current = readOwnedWarehouseTopology(reader, errors, warehouseId, organizationId);
  const metadata: WarehouseImportMetadataValue = { references: [], rollback: null, topologyRevision: current?.revision ?? 0 };

  if (scope.templateId === WAREHOUSE_CELLS_TEMPLATE_ID) {
    const entries = mapWarehouseCellRows(rows, columns);
    const valid = entries.filter(({ cell, row }) => {
      for (const issue of validator.collect(WarehouseCellInputSchema, cell)) {
        addWarehouseRowError(row, columns, cellField(issue.fieldPath), issue.ruleId);
      }
      return row.errors.length === 0;
    });
    const plan = planWarehouseCells(current, valid.map(entry => entry.cell));
    for (const issue of plan.violations) {
      const row = valid[issue.index]?.row;
      if (row !== undefined) {
        addWarehouseRowError(row, columns, cellField(issue.fieldPath), issue.ruleId);
      }
    }

    return {
      apply: (transaction) => {
        const { addedCellIds, topology } = plan.materialize(warehouseId, organizationId, () => runtime.random.uuid());
        saveWarehouseTopology(transaction, runtime, topology);
        return {
          addedCellIds,
          previousTopologyBytes: current === undefined ? null : toBinary(WarehouseTopologySchema, current),
          revision: topology.revision,
        };
      },
      metadata,
    };
  }

  const { groups, references } = mapWarehouseStockRows(reader, { columns, jobId, organizationId, rows, topology: current, warehouseId });
  metadata.references = references;
  const valid = groups.filter(({ request, rows: groupRows }) => {
    for (const issue of validator.collect(PostOpeningStockRequestSchema, request)) {
      const { field, line } = stockIssue(issue.fieldPath);
      const row = groupRows[line ?? 0];
      if (row !== undefined) {
        addWarehouseRowError(row, columns, field, issue.ruleId);
      }
    }
    return groupRows.every(row => row.errors.length === 0);
  });
  const plan = planOpeningStock(reader, errors, organizationId, warehouseId, valid.map(group => group.request));
  for (const issue of plan.violations) {
    const { field, line } = stockIssue(issue.fieldPath);
    const row = valid[issue.requestIndex]?.rows[line ?? 0];
    if (row !== undefined) {
      addWarehouseRowError(row, columns, field, issue.ruleId);
    }
  }
  return {
    apply: (transaction) => {
      applyOpeningStockPlan(transaction, runtime, caller, plan);
      return null;
    },
    metadata,
  };
};

export const previewWarehouseImport = (
  reader: IStateReader,
  runtime: IModuleRuntime,
  input: Omit<WarehouseImportInputValue, 'columns' | 'rows'>,
  table: readonly (readonly WarehouseXlsxCellValue[])[],
): WarehousePreviewValue => {
  const template = getWarehouseImportTemplate(input.scope, runtime.errors);
  const header = table[0] ?? [];
  const lastColumn = header.findLastIndex(cell => cell.kind === 'error' || cell.text.trim() !== '');
  const columns = readImportColumns(header.slice(0, lastColumn + 1).map(cell => cell.text), template);
  const rows = mapWarehouseRows(table, columns, template);
  const { metadata } = prepareWarehouseImport(reader, runtime, { ...input, columns, rows });
  return { columns, metadata, rows };
};

export const commitWarehouseImport = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  input: Omit<WarehouseImportInputValue, 'columns' | 'jobId' | 'rows'>,
  record: ImportRecordValue,
): void => {
  const previous = record.warehouseImport;
  if (previous === undefined) {
    throw runtime.errors.internal();
  }

  const { columns, rows } = record;
  const plan = prepareWarehouseImport(transaction, runtime, { ...input, columns, jobId: record.id, rows });
  if (input.scope.templateId === WAREHOUSE_CELLS_TEMPLATE_ID && previous.topologyRevision !== plan.metadata.topologyRevision) {
    throw runtime.errors.versionConflict(EntityKind.WAREHOUSE, plan.metadata.topologyRevision);
  }

  const currentReferences = new Map(plan.metadata.references.map(reference => [reference.rowNumber, reference]));
  const rowsByNumber = new Map(rows.map(row => [row.rowNumber, row]));
  for (const reference of previous.references) {
    const current = currentReferences.get(reference.rowNumber);
    const row = rowsByNumber.get(reference.rowNumber);
    if (row !== undefined && current !== undefined) {
      if (current.cellId !== reference.cellId) {
        addWarehouseRowError(row, columns, 'cell_code', 'import.reference_changed');
      }
      if (current.productId !== reference.productId || current.baseUnit !== reference.baseUnit) {
        addWarehouseRowError(row, columns, 'sku', 'import.reference_changed');
      }
    }
  }

  const violations = rows.flatMap(row => row.errors.map(error => ({
    fieldPath: `rows[${String(row.rowNumber - 2)}].${error.fieldPath}`, ruleId: error.ruleId,
  })));
  if (rows.length === 0) {
    violations.push({ fieldPath: 'rows', ruleId: 'repeated.min_items' });
  }
  if (violations.length > 0) {
    throw runtime.errors.validationFailed(violations.slice(0, 1000));
  }
  previous.rollback = plan.apply(transaction);
  record.job.status = ImportStatus.COMMITTED;
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
  const hasMovements = transaction.listBy('stockMovements', 'scopeId', warehouseId).some((entry) => {
    const movement = readStockMovement(entry, tenantId, errors);
    return ids.has(movement.toCellId) || (movement.fromCellId !== undefined && ids.has(movement.fromCellId));
  });
  if (hasMovements || topology.revision >= 2_147_483_647) {
    return blocked();
  }

  const restored = rollback.previousTopologyBytes === null
    ? create(WarehouseTopologySchema, { tenantId, warehouseId })
    : fromBinary(WarehouseTopologySchema, rollback.previousTopologyBytes);
  if (restored.tenantId !== tenantId || restored.warehouseId !== warehouseId) {
    throw errors.internal();
  }
  restored.revision = topology.revision + 1;
  saveWarehouseTopology(transaction, runtime, restored);
  record.job.status = ImportStatus.ROLLED_BACK;
};
