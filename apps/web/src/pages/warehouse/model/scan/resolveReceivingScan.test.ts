import {
  expect,
  it,
} from 'vitest';

import { resolveReceivingScan } from './resolveReceivingScan';

const GTIN = '02000000000015';
const SSCC = '000000000000000017';
const MARKING = `01${GTIN}21DemoA\u001D91DEMO\u001D92signature`;
const CONTEXT = {
  currentSscc: '',
  expectedCodes: [MARKING, 'DEMO-CODE'],
  expectedSsccs: [SSCC],
  gtin: '2000000000015',
  hasMarking: true,
  isLabelled: false,
  markingCodes: '',
  receivedCodes: [],
  receivedSsccs: [],
  sscc: undefined,
};

it('finds the documented serial independent of transport format and keeps the value from the manifest', () => {
  expect(resolveReceivingScan(`]d201${GTIN}21DemoA`, CONTEXT)).toEqual({ field: 'markingCodes', value: MARKING });
  expect(resolveReceivingScan('DEMO-CODE', CONTEXT)).toEqual({ field: 'markingCodes', value: 'DEMO-CODE' });
  expect(resolveReceivingScan(`01${GTIN}21DemoB`, CONTEXT)).toEqual({
    field: 'markingCodes', value: `01${GTIN}21DemoB`,
  });
});

it('reports repeats within the form and across received places by GTIN and serial', () => {
  for (const context of [{ ...CONTEXT, markingCodes: MARKING }, { ...CONTEXT, receivedCodes: [MARKING] }]) {
    expect(resolveReceivingScan(`(01)${GTIN}(21)DemoA`, context)).toEqual({ error: 'warehouseWork.error.duplicate' });
  }
});

it('uses the expected GTIN or SSCC and rejects an unrelated or already received code', () => {
  expect(resolveReceivingScan(`(01)${GTIN}(10)LOT-A`, CONTEXT)).toEqual({ field: 'gtin', value: GTIN });
  expect(resolveReceivingScan(`(01)${GTIN}(10)LOT-B`, { ...CONTEXT, batch: 'LOT-A' })).toEqual({
    error: 'warehouseWork.error.invalidCode',
  });
  expect(resolveReceivingScan('2000000000022', CONTEXT)).toEqual({ error: 'warehouseWork.error.invalidCode' });
  expect(resolveReceivingScan(SSCC, { ...CONTEXT, isLabelled: true, sscc: SSCC })).toEqual({ field: 'sscc', value: SSCC });
  expect(resolveReceivingScan(SSCC, { ...CONTEXT, isLabelled: true, receivedSsccs: [SSCC] })).toEqual({
    error: 'warehouseWork.error.duplicate',
  });
});

it('rejects a foreign SSCC and a repeat in the same receive form', () => {
  const labelled = { ...CONTEXT, isLabelled: true };
  expect(resolveReceivingScan('000000000000000024', labelled)).toEqual({ error: 'warehouseWork.error.invalidCode' });
  expect(resolveReceivingScan(SSCC, { ...labelled, currentSscc: SSCC })).toEqual({ error: 'warehouseWork.error.duplicate' });
});
