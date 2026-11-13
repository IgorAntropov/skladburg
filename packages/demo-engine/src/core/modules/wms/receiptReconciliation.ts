import type {
  Deal,
  ReceiptLineComparison,
} from '@skladburg/contracts/deal/v1/deal';
import type {
  ExpectedReceivingBatch,
  ReceivedHandlingUnit,
  ReceivingTask,
} from '@skladburg/contracts/wms/v1/receiving';
import type { StockLine } from '@skladburg/contracts/wms/v1/stock';

import {
  create,
  equals,
} from '@bufbuild/protobuf';
import { MarkingMode } from '@skladburg/contracts/catalog/v1/catalog';
import { ReceiptLineComparisonSchema } from '@skladburg/contracts/deal/v1/deal';
import {
  StockLineSchema,
  StockMovementKind,
  StockStatus,
} from '@skladburg/contracts/wms/v1/stock';

import type { PermissionCallerValue } from '../../access/index';
import type { IDomainErrors } from '../../errors/index';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { toCalendarDate } from '../../calendar/index';
import { computeGoodsTotal } from '../catalog/quote/tierPricing';
import {
  MAX_DEAL_INTEGER,
  rub,
} from '../deals/dealRules';
import { describeAvailableUnit } from './outboundAvailability';
import {
  publishStockAvailabilityChanged,
  publishStockChanged,
  readStockBalance,
  recordStockMovement,
} from './stockRecords';

export interface ReceiptReconciliationValue {
  acceptedGoodsMinor: bigint;
  hasDiscrepancies: boolean;
  lines: ReceiptLineComparison[];
  units: ReceiptUnitAllocationValue[];
}

interface ReceiptAllocationValue {
  accepted: bigint;
  defective: bigint;
}

interface ReceiptUnitAllocationValue {
  fact: ReceivedHandlingUnit;
  lines: ReceiptAllocationValue[];
}

const minQuantity = (first: bigint, second: bigint): bigint => first < second ? first : second;

const readMarking = (
  batch: ExpectedReceivingBatch,
  markingCodes: readonly string[],
  defectiveMarkingCodes: readonly string[],
): { accepted: bigint; missing: bigint; unexpected: bigint } => {
  const expected = new Set(batch.markingCodes);
  const defective = new Set(defectiveMarkingCodes);
  let matched = 0n;
  let accepted = 0n;
  let unexpected = 0n;
  for (const code of markingCodes) {
    if (expected.has(code)) {
      matched += 1n;
      if (!defective.has(code)) {
        accepted += 1n;
      }
    }
    else {
      unexpected += 1n;
    }
  }

  return { accepted, missing: batch.quantityBase - matched, unexpected };
};

const collectReceipt = (
  errors: IDomainErrors,
  task: ReceivingTask,
  byLine: ReadonlyMap<string, ReceiptLineComparison>,
  unitMarkedLines: ReadonlySet<string>,
): ReceiptUnitAllocationValue[] => {
  const receivedByUnit = new Map(task.receivedUnits.map(unit => [unit.expectedUnitId, unit]));
  const allocations: ReceiptUnitAllocationValue[] = [];
  if (receivedByUnit.size !== task.receivedUnits.length) {
    throw errors.internal();
  }

  for (const unit of task.expectedUnits) {
    const received = receivedByUnit.get(unit.id);
    const evidence = received?.batchFacts ?? [];
    const stockLines = received?.balanceAtReceipt?.lines ?? [];
    const lines: ReceiptAllocationValue[] = [];
    let stockIndex = 0;
    if (evidence.length > 0 && evidence.length !== unit.batches.length) {
      throw errors.internal();
    }

    for (const [batchIndex, batch] of unit.batches.entries()) {
      const line = byLine.get(batch.dealLineId);
      const fact = evidence[batchIndex];
      const actual = fact?.quantityBase ?? stockLines[batchIndex]?.quantityBase ?? 0n;
      const defective = fact?.defectiveQuantityBase ?? 0n;
      if (line === undefined || batch.quantityBase <= 0n || defective > actual || defective < 0n || actual < 0n
        || (fact !== undefined && fact.batchIndex !== batchIndex)) {
        throw errors.internal();
      }

      const documentedFact = minQuantity(batch.quantityBase, actual);
      const matching = unitMarkedLines.has(batch.dealLineId)
        ? readMarking(batch, fact?.markingCodes ?? [], fact?.defectiveMarkingCodes ?? [])
        : undefined;
      const good = minQuantity(documentedFact, actual - defective);
      const accepted = minQuantity(matching?.accepted ?? good, line.orderedQuantityBase - line.acceptedQuantityBase);
      line.documentedQuantityBase += batch.quantityBase;
      line.receivedQuantityBase += actual;
      line.defectiveQuantityBase += defective;
      line.acceptedQuantityBase += accepted;
      line.shortageQuantityBase += batch.quantityBase - documentedFact;
      line.excessQuantityBase += actual - documentedFact;
      line.missingMarkingCount += matching?.missing ?? 0n;
      line.unexpectedMarkingCount += matching?.unexpected ?? 0n;

      if (actual > 0n) {
        if (stockLines[stockIndex]?.quantityBase !== actual) {
          throw errors.internal();
        }
        lines.push({ accepted, defective });
        stockIndex += 1;
      }
    }

    if (stockIndex !== stockLines.length) {
      throw errors.internal();
    }
    if (received !== undefined) {
      allocations.push({ fact: received, lines });
    }
  }

  if (allocations.length !== task.receivedUnits.length) {
    throw errors.internal();
  }

  return allocations;
};

export const reconcileWarehouseReceipt = (
  { errors }: Pick<IModuleRuntime, 'errors'>,
  task: ReceivingTask,
  deal: Deal,
): ReceiptReconciliationValue => {
  const byLine = new Map(task.orderLines.map(line => [line.dealLineId, create(ReceiptLineComparisonSchema, {
    dealLineId: line.dealLineId,
    orderedQuantityBase: line.quantityBase,
  })]));
  if (task.dealId !== deal.id || task.warehouseId !== deal.shipToWarehouseId || byLine.size !== deal.lines.length) {
    throw errors.internal();
  }
  const unitMarkedLines = new Set(task.orderLines.filter(line => line.markingMode === MarkingMode.UNIT).map(line => line.dealLineId));
  for (const line of deal.lines) {
    if (line.productSnapshot?.markingMode === MarkingMode.UNIT) {
      unitMarkedLines.add(line.id);
    }
  }
  const units = collectReceipt(errors, task, byLine, unitMarkedLines);

  let acceptedGoodsMinor = 0n;
  let hasDiscrepancies = false;
  const lines = deal.lines.map((line): ReceiptLineComparison => {
    const comparison = byLine.get(line.id);
    if (comparison?.orderedQuantityBase !== line.quantity || line.price === undefined || line.priceUnitCoefficient <= 0n) {
      throw errors.internal();
    }

    const { documentedQuantityBase, orderedQuantityBase, receivedQuantityBase } = comparison;
    const documentedFact = receivedQuantityBase - comparison.excessQuantityBase;
    comparison.excessQuantityBase += documentedFact - minQuantity(documentedFact, orderedQuantityBase);
    comparison.shortageQuantityBase += orderedQuantityBase - minQuantity(documentedQuantityBase, orderedQuantityBase);
    comparison.documentedQuantityBase = minQuantity(documentedQuantityBase, MAX_DEAL_INTEGER);
    comparison.receivedQuantityBase = minQuantity(receivedQuantityBase, MAX_DEAL_INTEGER);
    comparison.excessQuantityBase = minQuantity(comparison.excessQuantityBase, MAX_DEAL_INTEGER);
    comparison.shortageQuantityBase = minQuantity(comparison.shortageQuantityBase, MAX_DEAL_INTEGER);
    comparison.missingMarkingCount = minQuantity(comparison.missingMarkingCount, MAX_DEAL_INTEGER);
    const amount = computeGoodsTotal(comparison.acceptedQuantityBase, line.price.amountMinor, line.priceUnitCoefficient);
    comparison.acceptedGoodsAmount = rub(amount);
    acceptedGoodsMinor += amount;
    hasDiscrepancies ||= documentedQuantityBase !== orderedQuantityBase || comparison.shortageQuantityBase > 0n
      || comparison.excessQuantityBase > 0n || comparison.defectiveQuantityBase > 0n || comparison.missingMarkingCount > 0n
      || comparison.unexpectedMarkingCount > 0n;
    return comparison;
  });

  return { acceptedGoodsMinor, hasDiscrepancies, lines, units };
};

const classifyLines = (stockLines: readonly StockLine[], allocations: readonly ReceiptAllocationValue[]): StockLine[] =>
  stockLines.flatMap((line, index) => {
    const { accepted = 0n, defective = 0n } = allocations[index] ?? {};
    const quarantine = line.quantityBase - accepted - defective;
    const amounts = [
      { quantityBase: accepted, status: StockStatus.AVAILABLE },
      { quantityBase: defective, status: StockStatus.DEFECTIVE },
      { quantityBase: quarantine, status: StockStatus.QUARANTINE },
    ];

    return amounts.filter(({ quantityBase }) => quantityBase > 0n)
      .map(({ quantityBase, status }) => create(StockLineSchema, { batch: line.batch, quantityBase, status }));
  });

export const classifyWarehouseReceipt = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  caller: PermissionCallerValue,
  task: ReceivingTask,
  result: ReceiptReconciliationValue,
  sourceDocumentNumber: string,
): void => {
  const { errors } = runtime;
  const warehouse = transaction.get('warehouses', task.warehouseId);
  if (warehouse?.tenantId !== caller.organizationId) {
    throw errors.internal();
  }
  const today = toCalendarDate(transaction.worldTimeMs, warehouse.timeZone);
  let hasMovements = false;
  let hasAvailableUnit = false;
  for (const { fact, lines } of result.units) {
    if (lines.every(line => line.accepted === 0n && line.defective === 0n)) {
      continue;
    }

    const original = fact.balanceAtReceipt;
    const originalUnit = original?.handlingUnit;
    const record = originalUnit === undefined ? undefined : transaction.get('stockBalances', originalUnit.id);
    if (original === undefined || originalUnit === undefined || record?.scopeId !== task.warehouseId) {
      throw errors.internal();
    }
    const balance = readStockBalance(record, caller.organizationId, errors);
    const { cellId, handlingUnit, receivingAreaId } = balance;
    const hasExpectedLocation = fact.putAwayCellId === undefined ? receivingAreaId === task.receivingAreaId : receivingAreaId === undefined;
    const hasOriginalLines = balance.lines.every((line, index) => {
      const originalLine = original.lines[index];
      return originalLine !== undefined && equals(StockLineSchema, line, originalLine);
    });
    if (handlingUnit?.sscc !== originalUnit.sscc || handlingUnit.version >= 2_147_483_647 || !hasExpectedLocation
      || balance.lines.length !== lines.length || balance.lines.length !== original.lines.length || !hasOriginalLines) {
      throw errors.internal();
    }

    handlingUnit.version += 1;
    balance.lines = classifyLines(balance.lines, lines);
    recordStockMovement(transaction, runtime, caller.user.id, balance, {
      dealId: task.dealId,
      fromCellId: cellId === '' ? undefined : cellId,
      fromReceivingAreaId: receivingAreaId,
      isEventDeferred: true,
      kind: StockMovementKind.RECEIPT_CLASSIFICATION,
      sourceDocumentNumber,
    });
    hasMovements = true;
    hasAvailableUnit ||= describeAvailableUnit(balance, today) !== undefined;
  }

  if (hasAvailableUnit) {
    publishStockAvailabilityChanged(transaction, runtime, warehouse.id, caller.organizationId);
  }
  else if (hasMovements) {
    publishStockChanged(transaction, runtime.outbox, warehouse.id);
  }
};
