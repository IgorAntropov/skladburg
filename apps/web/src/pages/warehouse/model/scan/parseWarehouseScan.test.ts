import {
  expect,
  it,
} from 'vitest';

import { parseWarehouseScan } from './parseWarehouseScan';

const SSCC = '000000000000000017';
const GTIN = '02000000000015';
const MARKING = `01${GTIN}21DemoSerial\u001D91DEMO\u001D92signature`;

it('reads plain GTINs and pallet or carton SSCCs, preserving leading zeroes', () => {
  expect(parseWarehouseScan(']E02000000000015')).toMatchObject({ gtin: '2000000000015', kind: 'product' });
  expect(parseWarehouseScan(']E412345670')).toMatchObject({ gtin: '12345670', kind: 'product' });
  expect(parseWarehouseScan(GTIN)).toMatchObject({ gtin: GTIN, kind: 'product' });
  for (const raw of [SSCC, `]C100${SSCC}`, `00${SSCC}`, `(00)${SSCC}`]) {
    expect(parseWarehouseScan(raw)).toEqual({ kind: 'unit', sscc: SSCC });
  }
});

it('reads AIM and GS, batch, expiry, serial and the demo crypto tail', () => {
  expect(parseWarehouseScan(`]d201${GTIN}17270200\u001D10LotA\u001D21DemoSerial\u001D91DEMO\u001D92signature`))
    .toMatchObject({
      batch: 'LotA', cryptoTail: '91DEMO\u001D92signature', expiry: '270200', gtin: GTIN, kind: 'product', serial: 'DemoSerial',
    });
  expect(parseWarehouseScan(`(01)${GTIN}(21)DemoSerial(91)DEMO(92)signature`)).toEqual(parseWarehouseScan(MARKING));
});

it('returns a local cell code or an opaque code for exact contextual matching', () => {
  expect(parseWarehouseScan('  wh-02-01  ')).toEqual({ code: 'wh-02-01', kind: 'local' });
  expect(parseWarehouseScan('DEMO.CARTON_001')).toEqual({ code: 'DEMO.CARTON_001', kind: 'local' });
  expect(parseWarehouseScan(']Q1WH-02-01')).toEqual({ code: 'WH-02-01', kind: 'local' });
});

it.each([
  '', '000000000000000018', '2000000000016', ']d20102000000000016', ']C1000000000000000000171',
  `]d201${GTIN}17270230`, `]d201${GTIN}17271300`, `]d201${GTIN}21DemoSerial91DEMO92signature`,
  `]d201${GTIN}21`, `]d201${GTIN}21A\u001D21B`, `]d201${GTIN}91DEMO`, 'https://example.test/stock',
])('rejects malformed or unsupported code %s', (raw) => {
  expect(parseWarehouseScan(raw)).toBeUndefined();
});
