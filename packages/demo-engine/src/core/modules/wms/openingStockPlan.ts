import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { hasGs1CheckDigit } from '@skladburg/contracts/forms';
import {
  type Batch,
  BatchSchema,
  type HandlingUnitKind,
  type OpeningStockLine,
  type PostOpeningStockRequest,
  type PostOpeningStockResponse,
  PostOpeningStockResponseSchema,
  StockBalanceSchema,
  StockLineSchema,
  StockMovementKind,
  type StockStatus,
} from '@skladburg/contracts/wms/v1/stock';

import type { PermissionCallerValue } from '../../access/index';
import type {
  IDomainErrors,
  ViolationValue,
} from '../../errors/index';
import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  buildStockBatchKey,
  hasSameStockExpiry,
  readStockBatch,
  writeStockBatch,
} from './stockBatches';
import {
  findMissingStockCellIds,
  prepareStockReference,
} from './stockLocations';
import {
  buildSsccKey,
  publishStockAvailabilityChanged,
  recordStockMovement,
} from './stockRecords';

export interface OpeningStockPlanValue {
  batches: ReadonlyMap<string, PlannedOpeningBatchValue>;
  tenantId: string;
  units: readonly PlannedOpeningUnitValue[];
  violations: readonly OpeningStockViolationValue[];
  warehouseId: string;
}

interface OpeningStockIssueValue extends ViolationValue {
  entity?: EntityKind | undefined;
}

interface OpeningStockViolationValue extends OpeningStockIssueValue {
  requestIndex: number;
}

interface PlannedOpeningBatchValue {
  batch: Batch;
  isNew: boolean;
}

interface PlannedOpeningLineValue {
  batchKey: string;
  quantityBase: bigint;
  status: StockStatus;
}

interface PlannedOpeningUnitValue {
  cellId: string;
  kind: HandlingUnitKind;
  lines: readonly PlannedOpeningLineValue[];
  sourceDocumentNumber: string;
  sscc: string;
}

const prepareOpeningLine = (
  reader: IStateReader,
  errors: IDomainErrors,
  tenantId: string,
  batches: Map<string, PlannedOpeningBatchValue>,
  line: OpeningStockLine,
): OpeningStockIssueValue | PlannedOpeningLineValue => {
  const product = reader.get('products', line.productId);

  if (product?.tenantId !== tenantId) {
    return { entity: EntityKind.PRODUCT, fieldPath: 'product_id', ruleId: 'stock.product_not_found' };
  }

  const reference = prepareStockReference(line.batchNumber);
  if ('ruleId' in reference) {
    return { fieldPath: 'batch_number', ruleId: reference.ruleId };
  }

  const number = reference.value;
  const batchKey = buildStockBatchKey(tenantId, product.id, number);
  const { expiresOn } = line;
  let planned = batches.get(batchKey);

  if (planned === undefined) {
    const existing = readStockBatch(reader, errors, batchKey, product, number);
    planned = existing === undefined
      ? {
          batch: create(BatchSchema, {
            baseUnit: product.baseUnit,
            expiresOn: expiresOn === undefined ? undefined : clone(CalendarDateSchema, expiresOn),
            number,
            productId: product.id,
            tenantId,
          }),
          isNew: true,
        }
      : { batch: existing, isNew: false };
    batches.set(batchKey, planned);
  }

  const { batch } = planned;
  if (batch.baseUnit !== product.baseUnit) {
    return { fieldPath: 'product_id', ruleId: 'stock.batch_unit_mismatch' };
  }

  if (!hasSameStockExpiry(batch.expiresOn, expiresOn)) {
    return { fieldPath: 'expires_on', ruleId: 'stock.batch_expiry_mismatch' };
  }

  return { batchKey, quantityBase: line.quantityBase, status: line.status };
};

export const planOpeningStock = (
  reader: IStateReader,
  errors: IDomainErrors,
  tenantId: string,
  warehouseId: string,
  requests: readonly PostOpeningStockRequest[],
): OpeningStockPlanValue => {
  const batches = new Map<string, PlannedOpeningBatchValue>();
  const missingCells = findMissingStockCellIds(reader, errors, warehouseId, tenantId, requests.map(request => request.cellId));
  const units: PlannedOpeningUnitValue[] = [];
  const violations: OpeningStockViolationValue[] = [];
  const seenSsccs = new Set<string>();

  for (const [requestIndex, request] of requests.entries()) {
    const { cellId, kind, sscc } = request;
    if (request.warehouseId !== warehouseId) {
      throw errors.internal();
    }

    if (missingCells.has(cellId)) {
      violations.push({ entity: EntityKind.WAREHOUSE_CELL, fieldPath: 'cell_id', requestIndex, ruleId: 'stock.cell_not_found' });
    }

    if (!hasGs1CheckDigit(sscc)) {
      violations.push({ fieldPath: 'sscc', requestIndex, ruleId: 'stock.sscc_checksum' });
    }
    else if (seenSsccs.has(sscc) || reader.listBy('stockBalances', 'lookupKey', buildSsccKey(tenantId, sscc)).length > 0) {
      violations.push({ fieldPath: 'sscc', requestIndex, ruleId: 'stock.sscc_taken' });
    }

    seenSsccs.add(sscc);
    const reference = prepareStockReference(request.sourceDocumentNumber);
    if ('ruleId' in reference) {
      violations.push({ fieldPath: 'source_document_number', requestIndex, ruleId: reference.ruleId });
    }

    const lines: PlannedOpeningLineValue[] = [];
    const seenLines = new Set<string>();
    for (const [lineIndex, input] of request.lines.entries()) {
      const path = `lines[${String(lineIndex)}]`;
      const line = prepareOpeningLine(reader, errors, tenantId, batches, input);

      if ('ruleId' in line) {
        violations.push({ ...line, fieldPath: `${path}.${line.fieldPath}`, requestIndex });
        continue;
      }

      const lineKey = `${line.batchKey}:${String(line.status)}`;
      if (seenLines.has(lineKey)) {
        violations.push({ fieldPath: `${path}.batch_number`, requestIndex, ruleId: 'stock.duplicate_line' });
        continue;
      }

      seenLines.add(lineKey);
      lines.push(line);
    }

    if ('value' in reference) {
      units.push({ cellId, kind, lines, sourceDocumentNumber: reference.value, sscc });
    }
  }

  return { batches, tenantId, units, violations, warehouseId };
};

const applyOpeningBatch = (
  transaction: IStateTransaction,
  runtime: Pick<IModuleRuntime, 'errors' | 'random'>,
  plan: OpeningStockPlanValue,
  appliedBatches: Map<string, Batch>,
  batchKey: string,
): Batch => {
  const applied = appliedBatches.get(batchKey);
  if (applied !== undefined) {
    return applied;
  }

  const planned = plan.batches.get(batchKey);
  if (planned === undefined) {
    throw runtime.errors.internal();
  }

  if (!planned.isNew) {
    return planned.batch;
  }

  const batch = writeStockBatch(transaction, runtime, planned.batch);
  appliedBatches.set(batchKey, batch);

  return batch;
};

export const applyOpeningStockPlan = (
  transaction: IStateTransaction,
  runtime: Pick<IModuleRuntime, 'errors' | 'outbox' | 'random' | 'wmsOutboundWarehouseIds'>,
  caller: Pick<PermissionCallerValue, 'organizationId'> & { user: Pick<PermissionCallerValue['user'], 'id'> },
  plan: OpeningStockPlanValue,
): PostOpeningStockResponse[] => {
  const { errors, random } = runtime;
  const { tenantId, units, violations, warehouseId } = plan;
  if (caller.organizationId !== tenantId) {
    throw errors.internal();
  }

  const [violation] = violations;
  if (violation !== undefined) {
    if (violation.entity !== undefined) {
      throw errors.notFound(violation.entity);
    }

    const { fieldPath, ruleId } = violation;
    throw errors.validationFailed([{ fieldPath, ruleId }]);
  }

  const appliedBatches = new Map<string, Batch>();
  const responses = units.map(({ cellId, kind, lines, sourceDocumentNumber, sscc }) => {
    const stockLines = lines.map(({ batchKey, quantityBase, status }) => create(StockLineSchema, {
      batch: applyOpeningBatch(transaction, runtime, plan, appliedBatches, batchKey),
      quantityBase,
      status,
    }));
    const id = random.uuid();
    if (transaction.get('stockBalances', id) !== undefined) {
      throw errors.internal();
    }

    const balance = create(StockBalanceSchema, {
      cellId,
      handlingUnit: { id, kind, sscc, tenantId, version: 1, warehouseId },
      lines: stockLines,
    });
    const movement = recordStockMovement(transaction, runtime, caller.user.id, balance, {
      fromCellId: undefined,
      isEventDeferred: true,
      kind: StockMovementKind.OPENING_BALANCE,
      sourceDocumentNumber,
    });

    return create(PostOpeningStockResponseSchema, { balance, movement });
  });

  if (responses.length > 0) {
    publishStockAvailabilityChanged(transaction, runtime, warehouseId, caller.organizationId);
  }

  return responses;
};
