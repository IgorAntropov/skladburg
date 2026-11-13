import type {
  ExpectedReceivingUnit,
  ReceivingBatchEvidence,
  ReceivingBatchFact,
  ReceivingTask,
} from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import {
  BaseUnit,
  MarkingMode,
} from '@skladburg/contracts/catalog/v1/catalog';
import { ReceivingBatchFactSchema } from '@skladburg/contracts/wms/v1/receiving';

import type { IDomainErrors } from '../../errors/index';

import { MAX_DEAL_INTEGER } from '../deals/dealRules';

const MARKING_CODE_LENGTH = 128;
export const MAX_RECEIVING_MARKING_CODES = 1000;

export const isReceivingMarkingCode = (code: string): boolean =>
  code !== '' && code === code.trim() && Array.from(code).length <= MARKING_CODE_LENGTH;

const failEvidence = (errors: IDomainErrors, fieldPath: string, ruleId: string): never => {
  throw errors.validationFailed([{ fieldPath, ruleId }]);
};

const validateMarkingEvidence = (
  errors: IDomainErrors,
  evidence: ReceivingBatchEvidence,
  quantityBase: bigint,
  usedCodes: Set<string>,
): void => {
  const { defectiveMarkingCodes, defectiveQuantityBase, markingCodes } = evidence;
  const codes = new Set(markingCodes);
  const defectiveCodes = new Set(defectiveMarkingCodes);
  if (codes.size !== markingCodes.length || defectiveCodes.size !== defectiveMarkingCodes.length
    || markingCodes.some(code => usedCodes.has(code))) {
    failEvidence(errors, 'batch_evidence.marking_codes', 'scan_duplicate_code');
  }
  const codedQuantity = BigInt(codes.size);
  const codedDefects = BigInt(defectiveCodes.size);
  if (codedQuantity > quantityBase || codes.size > MAX_RECEIVING_MARKING_CODES || markingCodes.some(code => !isReceivingMarkingCode(code))
    || defectiveMarkingCodes.some(code => !codes.has(code))
    || codedDefects > defectiveQuantityBase || defectiveQuantityBase - codedDefects > quantityBase - codedQuantity) {
    failEvidence(errors, 'batch_evidence.marking_codes', 'scan_unexpected_item');
  }

  for (const code of codes) {
    usedCodes.add(code);
  }
};

export const readReceivingBatchFacts = (
  errors: IDomainErrors,
  task: ReceivingTask,
  unit: ExpectedReceivingUnit,
  quantityOverride: bigint | undefined,
  evidence: readonly ReceivingBatchEvidence[],
): ReceivingBatchFact[] => {
  const evidenceByBatch = new Map(evidence.map(entry => [entry.batchIndex, entry]));
  if (evidenceByBatch.size !== evidence.length || evidence.some(entry => unit.batches[entry.batchIndex] === undefined)) {
    failEvidence(errors, 'batch_evidence.batch_index', 'scan_unexpected_item');
  }
  if (quantityOverride !== undefined && evidence.some(entry => entry.quantityBase !== undefined)) {
    failEvidence(errors, 'batch_evidence.quantity_base', 'scan_unexpected_item');
  }
  const usedCodes = new Set(task.receivedUnits.flatMap(received => received.batchFacts.flatMap(batch => batch.markingCodes)));
  const orderLines = new Map(task.orderLines.map(line => [line.dealLineId, line]));
  const expectedByUnit = new Map(task.expectedUnits.map(expected => [expected.id, expected]));
  const previousByLine = new Map<string, bigint>();
  for (const received of task.receivedUnits) {
    const expected = expectedByUnit.get(received.expectedUnitId);
    if (expected === undefined) {
      throw errors.internal();
    }
    for (const [index, batch] of expected.batches.entries()) {
      const actual = received.batchFacts[index]?.quantityBase ?? received.balanceAtReceipt?.lines[index]?.quantityBase ?? 0n;
      previousByLine.set(batch.dealLineId, (previousByLine.get(batch.dealLineId) ?? 0n) + actual);
    }
  }

  const batchFacts = unit.batches.map((batch, batchIndex) => {
    const entry = evidenceByBatch.get(batchIndex);
    const quantityBase = entry?.quantityBase ?? quantityOverride ?? batch.quantityBase;
    const defectiveQuantityBase = entry?.defectiveQuantityBase ?? 0n;
    const markingCodes = entry?.markingCodes ?? [];
    const defectiveMarkingCodes = entry?.defectiveMarkingCodes ?? [];
    const orderLine = orderLines.get(batch.dealLineId);
    if (orderLine === undefined) {
      throw errors.internal();
    }
    if (defectiveQuantityBase < 0n || defectiveQuantityBase > quantityBase) {
      failEvidence(errors, 'batch_evidence.defective_quantity_base', 'scan_unexpected_item');
    }
    const receivedTotal = (previousByLine.get(batch.dealLineId) ?? 0n) + quantityBase;
    if (quantityBase < 0n || receivedTotal > MAX_DEAL_INTEGER) {
      failEvidence(errors, 'batch_evidence.quantity_base', 'catalog.amount_above_limit');
    }
    previousByLine.set(batch.dealLineId, receivedTotal);

    if (entry !== undefined) {
      if (orderLine.markingMode === MarkingMode.UNIT && orderLine.baseUnit === BaseUnit.PIECE) {
        validateMarkingEvidence(errors, entry, quantityBase, usedCodes);
      }
      else if (markingCodes.length > 0 || defectiveMarkingCodes.length > 0) {
        failEvidence(errors, 'batch_evidence.marking_codes', 'scan_unexpected_item');
      }
    }

    return create(ReceivingBatchFactSchema, { batchIndex, defectiveMarkingCodes, defectiveQuantityBase, markingCodes, quantityBase });
  });

  if (batchFacts.every(batch => batch.quantityBase === 0n)) {
    failEvidence(errors, 'batch_evidence.quantity_base', 'int64.gt');
  }

  return batchFacts;
};
