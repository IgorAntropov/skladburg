import {
  expect,
  it,
} from 'vitest';

import { parseWarehouseScan } from '../parseWarehouseScan';
import {
  createCameraCodeGate,
  toCameraScan,
} from './cameraCodes';

it('preserves AIM and the group separator in GS1 DataMatrix', () => {
  const result = toCameraScan({ isValid: true, symbologyIdentifier: ']d2', text: '010460123456789321ABC\u001D93XYZ' });
  expect(result).toBe(']d2010460123456789321ABC\u001D93XYZ');
  expect(parseWarehouseScan(result ?? '')).toMatchObject({ cryptoTail: '93XYZ', kind: 'product', serial: 'ABC' });
});

it('keeps regular QR URLs and local Code 128 independent of decoder-specific identifiers', () => {
  const address = 'https://example.test/skladburg/#/cells/00000000-0000-4000-8000-000000000001';
  expect(toCameraScan({ isValid: true, symbologyIdentifier: ']Q1', text: address })).toBe(address);
  expect(toCameraScan({ isValid: true, symbologyIdentifier: ']C0', text: 'A-01' })).toBe('A-01');
  expect(toCameraScan({ isValid: false, symbologyIdentifier: ']C0', text: 'A-01' })).toBeUndefined();
});

it('emits different codes immediately and rearms a held code after it leaves the frame', () => {
  const read = createCameraCodeGate();
  expect(read(['A', 'B'], 0)).toEqual(['A', 'B']);
  expect(read(['B', 'A'], 1000)).toEqual([]);
  expect(read(['A', 'C', 'C'], 1100)).toEqual(['C']);
  expect(read([], 1200)).toEqual([]);
  expect(read(['A'], 1400)).toEqual([]);
  expect(read(['B'], 2100)).toEqual(['B']);
});
