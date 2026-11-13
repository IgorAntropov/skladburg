import type {
  ExpectedReceivingUnit,
  ReceiveHandlingUnitRequest,
  ReceivingBatchFact,
  ReceivingTask,
} from '@skladburg/contracts/wms/v1/receiving';
import type { StockLine } from '@skladburg/contracts/wms/v1/stock';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  hasGs1CheckDigit,
  isGtinValid,
} from '@skladburg/contracts/forms';
import { parseSearchQuery } from '@skladburg/contracts/runtime';
import { ReceivedHandlingUnitSchema } from '@skladburg/contracts/wms/v1/receiving';
import {
  StockBalanceSchema,
  StockLineSchema,
  StockMovementKind,
  StockStatus,
} from '@skladburg/contracts/wms/v1/stock';

import type { PermissionCallerValue } from '../../access/index';
import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { readReceivingBatchFacts } from './receivingEvidence';
import {
  buildStockBatchKey,
  hasSameStockExpiry,
  readStockBatch,
  writeStockBatch,
} from './stockBatches';
import {
  buildSsccKey,
  recordStockMovement,
} from './stockRecords';

const MAX_SSCC_ATTEMPTS = 32;
const DEMO_SERIAL_RANGE = 1_000_000_000;
const DEMO_PREFIX_RANGE = 1_000_000;
const DECIMAL_DIGITS = '0123456789';

const isSsccUsed = (reader: IStateReader, tenantId: string, sscc: string): boolean =>
  reader.listBy('stockBalances', 'lookupKey', buildSsccKey(tenantId, sscc)).length > 0;

const createDemoSscc = (reader: IStateReader, runtime: IModuleRuntime, tenantId: string, task: ReceivingTask): string => {
  let prefixSeed = 0;
  for (const character of tenantId) {
    prefixSeed = (prefixSeed * 31 + character.charCodeAt(0)) % DEMO_PREFIX_RANGE;
  }
  const companyPrefix = `9${String(prefixSeed).padStart(6, '0')}`;
  const expectedSsccs = new Set(task.expectedUnits.map(unit => unit.sscc));
  for (let attempt = 0; attempt < MAX_SSCC_ATTEMPTS; attempt += 1) {
    const serial = String(runtime.random.nextInt(DEMO_SERIAL_RANGE)).padStart(9, '0');
    const body = `0${companyPrefix}${serial}`;
    for (const digit of DECIMAL_DIGITS) {
      const sscc = body + digit;
      if (hasGs1CheckDigit(sscc) && !expectedSsccs.has(sscc) && !isSsccUsed(reader, tenantId, sscc)) {
        return sscc;
      }
    }
  }
  throw runtime.errors.unavailable();
};

const failScan = (runtime: IModuleRuntime, fieldPath: string, ruleId: string): never => {
  throw runtime.errors.validationFailed([{ fieldPath, ruleId }]);
};

interface ReceivingUnitInputValue {
  expected: ExpectedReceivingUnit;
  quantityBase: bigint | undefined;
  sscc: string | undefined;
}

const readReceivingUnitInput = (
  runtime: IModuleRuntime,
  task: ReceivingTask,
  request: ReceiveHandlingUnitRequest,
): ReceivingUnitInputValue => {
  const { unit } = request;
  if (unit.case === 'sscc') {
    if (!hasGs1CheckDigit(unit.value)) {
      return failScan(runtime, 'sscc', 'stock.sscc_checksum');
    }
    const expected = task.expectedUnits.find(candidate => candidate.sscc === unit.value);
    if (expected === undefined) {
      return failScan(runtime, 'sscc', 'scan_unknown_code');
    }

    return { expected, quantityBase: undefined, sscc: unit.value };
  }
  if (unit.case !== 'unlabelledUnit') {
    throw runtime.errors.internal();
  }
  const { expectedUnitId, gtin, quantityBase } = unit.value;
  const expected = task.expectedUnits.find(candidate => candidate.id === expectedUnitId && candidate.sscc === undefined);
  if (expected === undefined) {
    return failScan(runtime, 'unlabelled_unit.expected_unit_id', 'scan_unexpected_item');
  }

  const orderLine = task.orderLines.find(line => line.dealLineId === expected.batches[0]?.dealLineId);
  if (orderLine === undefined || expected.batches.length !== 1) {
    throw runtime.errors.internal();
  }
  const actualGtin = parseSearchQuery(gtin).gtin;
  if (actualGtin === undefined || !isGtinValid(gtin) || actualGtin !== parseSearchQuery(orderLine.gtin).gtin) {
    return failScan(runtime, 'unlabelled_unit.gtin', 'scan_unexpected_item');
  }
  return { expected, quantityBase, sscc: undefined };
};

const readReceivedLines = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  tenantId: string,
  task: ReceivingTask,
  input: ReceivingUnitInputValue,
  facts: readonly ReceivingBatchFact[],
): StockLine[] => facts.filter(fact => fact.quantityBase > 0n).map(({ batchIndex, quantityBase }) => {
  const { errors } = runtime;
  const planned = input.expected.batches[batchIndex];
  const line = task.orderLines.find(candidate => candidate.dealLineId === planned?.dealLineId);
  if (planned === undefined || line === undefined) {
    throw errors.internal();
  }
  const { baseUnit, productId } = line;
  const { batchNumber, expiresOn } = planned;
  const lookupKey = buildStockBatchKey(tenantId, productId, batchNumber);
  const existing = readStockBatch(transaction, errors, lookupKey, { id: productId, tenantId }, batchNumber);
  if (existing !== undefined && (existing.baseUnit !== baseUnit || !hasSameStockExpiry(existing.expiresOn, expiresOn))) {
    return failScan(runtime, input.sscc === undefined ? 'unlabelled_unit.expected_unit_id' : 'sscc', 'stock.receiving_batch_conflict');
  }
  const batch = existing ?? writeStockBatch(transaction, runtime, { baseUnit, expiresOn, number: batchNumber, productId, tenantId });

  return create(StockLineSchema, { batch, quantityBase, status: StockStatus.QUARANTINE });
});

export const receiveHandlingUnit = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  caller: PermissionCallerValue,
  task: ReceivingTask,
  request: ReceiveHandlingUnitRequest,
): void => {
  const tenantId = caller.organizationId;
  const input = readReceivingUnitInput(runtime, task, request);
  const fieldPath = input.sscc === undefined ? 'unlabelled_unit.expected_unit_id' : 'sscc';
  if (task.receivedUnits.some(unit => unit.expectedUnitId === input.expected.id)
    || (input.sscc !== undefined && isSsccUsed(transaction, tenantId, input.sscc))) {
    return failScan(runtime, fieldPath, 'scan_duplicate_code');
  }
  const batchFacts = readReceivingBatchFacts(runtime.errors, task, input.expected, input.quantityBase, request.batchEvidence);
  const sscc = input.sscc ?? createDemoSscc(transaction, runtime, tenantId, task);
  const id = runtime.random.uuid();
  if (transaction.get('stockBalances', id) !== undefined) {
    throw runtime.errors.internal();
  }
  const balance = create(StockBalanceSchema, {
    handlingUnit: { id, kind: input.expected.kind, sscc, tenantId, version: 1, warehouseId: task.warehouseId },
    lines: readReceivedLines(transaction, runtime, tenantId, task, input, batchFacts),
    receivingAreaId: task.receivingAreaId,
  });
  recordStockMovement(transaction, runtime, caller.user.id, balance, {
    dealId: task.dealId,
    fromCellId: undefined,
    kind: StockMovementKind.RECEIPT,
    sourceDocumentNumber: task.sourceDocumentNumber,
  });
  task.receivedUnits.push(create(ReceivedHandlingUnitSchema, {
    balanceAtReceipt: balance,
    batchFacts,
    expectedUnitId: input.expected.id,
    receivedAt: timestampFromMs(transaction.worldTimeMs),
  }));
};
