import type { MessageInitShape } from '@bufbuild/protobuf';
import type { FormFieldIssueValue } from '@skladburg/contracts/forms';
import type {
  ReceiveHandlingUnitRequestSchema,
  ReceivingTask,
} from '@skladburg/contracts/wms/v1/receiving';

import {
  hasGs1CheckDigit,
  isGtinValid,
  validateFormValues,
} from '@skladburg/contracts/forms';
import { ReceivingBatchEvidenceFormRules } from '@skladburg/contracts/forms/wms/v1/receiving';

import { splitMarkingCodes } from './scan/splitMarkingCodes';

export interface ReceiveUnitEvidenceOptionsValue {
  hasEvidence?: boolean | undefined;
  hasMarking?: boolean | undefined;
}

export interface ReceiveUnitFormValue {
  actualQuantityBase: string;
  defectiveMarkingCodes: string;
  defectiveQuantityBase: string;
  gtin: string;
  markingCodes: string;
  quantityBase: string;
  sscc: string;
}

export interface ReceiveUnitOutputValue extends Omit<ReceiveUnitFormValue, ReceiveUnitNumberFieldValue> {
  actualQuantityBase: bigint | undefined;
  defectiveQuantityBase: bigint | undefined;
  quantityBase: bigint | undefined;
}

export type ReceiveUnitSelectionValue
  = | { expectedUnitId: string; gtin: string; kind: 'unlabelled' }
    | { expectedUnitId?: string | undefined; kind: 'labelled' };

type ReceiveUnitNumberFieldValue = 'actualQuantityBase' | 'defectiveQuantityBase' | 'quantityBase';

type ReceiveUnitRequestValue = Required<Pick<MessageInitShape<typeof ReceiveHandlingUnitRequestSchema>, 'batchEvidence' | 'unit'>>;

const MAX_INT64 = 9_223_372_036_854_775_807n;
const CODE_FIELDS = ['markingCodes', 'defectiveMarkingCodes'] as const;

export const createReceiveUnitRequest = (
  task: ReceivingTask,
  selection: ReceiveUnitSelectionValue,
  values: ReceiveUnitOutputValue,
  options: ReceiveUnitEvidenceOptionsValue,
): ReceiveUnitRequestValue => {
  const expected = task.expectedUnits.find(unit => unit.id === selection.expectedUnitId);
  const isLabelled = selection.kind === 'labelled';
  const canAttachEvidence = expected?.batches.length === 1;
  const quantityBase = isLabelled && options.hasEvidence ? values.actualQuantityBase : undefined;
  const defectiveQuantityBase = options.hasEvidence ? values.defectiveQuantityBase ?? 0n : 0n;
  const markingCodes = options.hasMarking ? splitMarkingCodes(values.markingCodes) : [];
  const defectiveMarkingCodes = options.hasMarking ? splitMarkingCodes(values.defectiveMarkingCodes) : [];
  const hasEvidence = quantityBase !== undefined || defectiveQuantityBase > 0n
    || markingCodes.length > 0 || defectiveMarkingCodes.length > 0;
  const batchEvidence = hasEvidence && canAttachEvidence
    ? [{ batchIndex: 0, defectiveMarkingCodes, defectiveQuantityBase, markingCodes, quantityBase }]
    : [];

  return {
    batchEvidence,
    unit: isLabelled
      ? { case: 'sscc', value: values.sscc }
      : {
          case: 'unlabelledUnit',
          value: { expectedUnitId: selection.expectedUnitId, gtin: values.gtin, quantityBase: values.quantityBase ?? 0n },
        },
  };
};

const validateEvidence = (request: ReceiveUnitRequestValue): FormFieldIssueValue[] => {
  const evidence = request.batchEvidence[0];
  if (evidence === undefined) {
    return [];
  }

  const issues = [...validateFormValues(ReceivingBatchEvidenceFormRules, { ...evidence }, CODE_FIELDS)];
  const markingCodes = new Set(evidence.markingCodes);
  for (const field of CODE_FIELDS) {
    const codes = evidence[field] ?? [];
    if (new Set(codes).size !== codes.length) {
      issues.push({ field, ruleId: 'repeated.unique' });
    }
  }
  if (evidence.defectiveMarkingCodes?.some(code => !markingCodes.has(code)) === true) {
    issues.push({ field: 'defectiveMarkingCodes', ruleId: 'scan_unexpected_item' });
  }

  return issues;
};

export const validateReceiveUnit = (
  task: ReceivingTask,
  selection: ReceiveUnitSelectionValue,
  values: ReceiveUnitOutputValue,
  options: ReceiveUnitEvidenceOptionsValue,
): readonly FormFieldIssueValue[] => {
  const isLabelled = selection.kind === 'labelled';
  if (isLabelled && !hasGs1CheckDigit(values.sscc)) {
    return [{ field: 'sscc', ruleId: 'stock.sscc_checksum' }];
  }
  if (!isLabelled && !isGtinValid(values.gtin)) {
    return [{ field: 'gtin', ruleId: 'scan_unexpected_item' }];
  }
  const expected = task.expectedUnits.find(unit => unit.id === selection.expectedUnitId);
  if (isLabelled && expected !== undefined && expected.sscc !== values.sscc) {
    return [{ field: 'sscc', ruleId: 'scan_unexpected_item' }];
  }

  const issues: FormFieldIssueValue[] = [];
  const quantityField = isLabelled ? 'actualQuantityBase' : 'quantityBase';
  const quantity = isLabelled && options.hasEvidence ? values.actualQuantityBase : isLabelled ? undefined : values.quantityBase;
  if (quantity !== undefined && quantity > MAX_INT64) {
    issues.push({ field: quantityField, ruleId: 'catalog.amount_above_limit' });
  }
  if (options.hasEvidence && values.defectiveQuantityBase !== undefined && values.defectiveQuantityBase > MAX_INT64) {
    issues.push({ field: 'defectiveQuantityBase', ruleId: 'catalog.amount_above_limit' });
  }

  return [...issues, ...validateEvidence(createReceiveUnitRequest(task, selection, values, options))];
};
