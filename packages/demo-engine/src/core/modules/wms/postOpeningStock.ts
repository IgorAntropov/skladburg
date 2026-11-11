import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { hasGs1CheckDigit } from '@skladburg/contracts/forms';
import {
  type Batch,
  BatchSchema,
  type OpeningStockLine,
  type PostOpeningStockRequest,
  type PostOpeningStockResponse,
  PostOpeningStockResponseSchema,
  StockBalanceSchema,
  type StockLine,
  StockLineSchema,
  StockMovementKind,
} from '@skladburg/contracts/wms/v1/stock';

import type { PermissionCallerValue } from '../../access/index';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  normalizeStockReference,
  requireStockCells,
} from './stockLocations';
import {
  buildSsccKey,
  recordStockMovement,
} from './stockRecords';

const getOpeningBatch = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  tenantId: string,
  line: OpeningStockLine,
  index: number,
): Batch => {
  const { errors, random } = runtime;
  const product = transaction.get('products', line.productId);

  if (product?.tenantId !== tenantId) {
    throw errors.notFound(EntityKind.PRODUCT);
  }

  const path = `lines[${String(index)}]`;
  const number = normalizeStockReference(line.batchNumber, `${path}.batch_number`, errors);
  const lookupKey = JSON.stringify([tenantId, product.id, number]);
  const [record, duplicate] = transaction.listBy('stockBatches', 'lookupKey', lookupKey);

  if (duplicate !== undefined) {
    throw errors.internal();
  }

  if (record !== undefined) {
    const batch = fromBinary(BatchSchema, record.bytes);

    if (batch.id !== record.id || record.scopeId !== product.id
      || batch.tenantId !== tenantId || batch.productId !== product.id || batch.number !== number) {
      throw errors.internal();
    }

    if (batch.baseUnit !== product.baseUnit) {
      throw errors.validationFailed([{ fieldPath: `${path}.product_id`, ruleId: 'stock.batch_unit_mismatch' }]);
    }

    const { expiresOn } = line;

    if (batch.expiresOn?.year !== expiresOn?.year || batch.expiresOn?.month !== expiresOn?.month
      || batch.expiresOn?.day !== expiresOn?.day) {
      throw errors.validationFailed([{ fieldPath: `${path}.expires_on`, ruleId: 'stock.batch_expiry_mismatch' }]);
    }

    return batch;
  }

  const id = random.uuid();
  if (transaction.get('stockBatches', id) !== undefined) {
    throw errors.internal();
  }

  const batch = create(BatchSchema, {
    baseUnit: product.baseUnit,
    expiresOn: line.expiresOn,
    id,
    number,
    productId: product.id,
    tenantId,
  });
  transaction.put('stockBatches', { bytes: toBinary(BatchSchema, batch), id: batch.id, lookupKey, scopeId: product.id });

  return batch;
};

const prepareLines = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  tenantId: string,
  input: readonly OpeningStockLine[],
): StockLine[] => {
  const seen = new Set<string>();

  return input.map((line, index) => {
    const batch = getOpeningBatch(transaction, runtime, tenantId, line, index);
    const key = `${batch.id}:${String(line.status)}`;

    if (seen.has(key)) {
      throw runtime.errors.validationFailed([{ fieldPath: `lines[${String(index)}].batch_number`, ruleId: 'stock.duplicate_line' }]);
    }

    seen.add(key);

    return create(StockLineSchema, { batch, quantityBase: line.quantityBase, status: line.status });
  });
};

export const postOpeningStock = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  caller: PermissionCallerValue,
  request: PostOpeningStockRequest,
): PostOpeningStockResponse => {
  const { errors, random } = runtime;
  const tenantId = caller.organizationId;
  const { cellId, kind, sscc, warehouseId } = request;
  requireStockCells(transaction, errors, warehouseId, tenantId, cellId);

  if (!hasGs1CheckDigit(sscc)) {
    throw errors.validationFailed([{ fieldPath: 'sscc', ruleId: 'stock.sscc_checksum' }]);
  }

  if (transaction.listBy('stockBalances', 'lookupKey', buildSsccKey(tenantId, sscc)).length > 0) {
    throw errors.validationFailed([{ fieldPath: 'sscc', ruleId: 'stock.sscc_taken' }]);
  }

  const sourceDocumentNumber = normalizeStockReference(request.sourceDocumentNumber, 'source_document_number', errors);
  const lines = prepareLines(transaction, runtime, tenantId, request.lines);
  const id = random.uuid();
  if (transaction.get('stockBalances', id) !== undefined) {
    throw errors.internal();
  }

  const balance = create(StockBalanceSchema, {
    cellId,
    handlingUnit: { id, kind, sscc, tenantId, version: 1, warehouseId },
    lines,
  });
  const movement = recordStockMovement(transaction, runtime, caller, balance, {
    fromCellId: undefined,
    kind: StockMovementKind.OPENING_BALANCE,
    sourceDocumentNumber,
  });

  return create(PostOpeningStockResponseSchema, { balance, movement });
};
