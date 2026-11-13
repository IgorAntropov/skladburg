import { create } from '@bufbuild/protobuf';
import { ReceivingTaskSchema } from '@skladburg/contracts/wms/v1/receiving';
import {
  expect,
  it,
} from 'vitest';

import {
  createReceiveUnitRequest,
  validateReceiveUnit,
} from './receiveUnitInput';

const SSCC = '000000000000000017';
const TASK = create(ReceivingTaskSchema, {
  expectedUnits: [
    { batches: [{ quantityBase: 8n }], id: 'pallet-1', sscc: SSCC },
    { batches: [{ quantityBase: 8n }], id: 'pallet-2' },
  ],
});

const UNLABELLED = { expectedUnitId: 'pallet-2', gtin: '2000000000015', kind: 'unlabelled' } as const;
const LABELLED = { expectedUnitId: 'pallet-1', kind: 'labelled' } as const;
const EVIDENCE = { hasEvidence: true, hasMarking: true };
const VALUES = {
  actualQuantityBase: undefined,
  defectiveMarkingCodes: '',
  defectiveQuantityBase: undefined,
  gtin: UNLABELLED.gtin,
  markingCodes: '',
  quantityBase: undefined,
  sscc: SSCC,
};

it('attaches typed measurements and separated code evidence to the selected labelled place', () => {
  const values = {
    ...VALUES, actualQuantityBase: 4n, defectiveMarkingCodes: 'C2', defectiveQuantityBase: 1n, markingCodes: 'C1 C2   C3',
  };
  expect(validateReceiveUnit(TASK, LABELLED, values, EVIDENCE)).toEqual([]);
  expect(createReceiveUnitRequest(TASK, LABELLED, values, EVIDENCE)).toEqual({
    batchEvidence: [{ batchIndex: 0, defectiveMarkingCodes: ['C2'], defectiveQuantityBase: 1n, markingCodes: ['C1', 'C2', 'C3'],
      quantityBase: 4n }],
    unit: { case: 'sscc', value: SSCC },
  });
});

it('passes an unlabelled count in the unit only and leaves defect evidence optional', () => {
  const values = { ...VALUES, actualQuantityBase: 99n, defectiveQuantityBase: 1n, quantityBase: 4n };
  expect(createReceiveUnitRequest(TASK, UNLABELLED, values, EVIDENCE)).toEqual({
    batchEvidence: [{ batchIndex: 0, defectiveMarkingCodes: [], defectiveQuantityBase: 1n, markingCodes: [], quantityBase: undefined }],
    unit: { case: 'unlabelledUnit', value: { expectedUnitId: UNLABELLED.expectedUnitId, gtin: UNLABELLED.gtin, quantityBase: 4n } },
  });
});

it('does not apply evidence for a different SSCC or send duplicate and out-of-scope defect codes', () => {
  expect(validateReceiveUnit(TASK, LABELLED, { ...VALUES, sscc: '000000000000000024' }, EVIDENCE)).toEqual([
    { field: 'sscc', ruleId: 'scan_unexpected_item' },
  ]);
  expect(validateReceiveUnit(TASK, LABELLED, { ...VALUES, markingCodes: 'C1 C1' }, EVIDENCE)).toEqual([
    { field: 'markingCodes', ruleId: 'repeated.unique' },
  ]);
  expect(validateReceiveUnit(TASK, LABELLED, {
    ...VALUES, defectiveMarkingCodes: 'C2', defectiveQuantityBase: 1n, markingCodes: 'C1',
  }, EVIDENCE)).toEqual([{ field: 'defectiveMarkingCodes', ruleId: 'scan_unexpected_item' }]);
});
