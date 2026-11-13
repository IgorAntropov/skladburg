import {
  expect,
  it,
} from 'vitest';

import { encodePrintCodes } from './encodePrintCodes';

const SSCC = '000000000000000017';
const QR = 'https://example.test/skladburg/#/cells/00000000-0000-4000-8000-000000000001';

it('renders a printable GS1-128 symbol and a square QR, preserving order', () => {
  const [unit, qr] = encodePrintCodes([{ kind: 'sscc', text: SSCC }, { kind: 'qr', text: QR }]);
  expect(unit?.svg).toMatch(/^<svg [^>]+><path|^<svg [^>]+>\n<path/u);
  expect(unit?.width).toBeGreaterThan(unit?.height ?? Infinity);
  expect(qr?.width).toBe(qr?.height);
  expect(qr?.width).toBeGreaterThan(20);
});

it('keeps the actual width of a long Code 128 address available to print layout', () => {
  const [short, long] = encodePrintCodes([{ kind: 'address', text: 'A1-001' }, { kind: 'address', text: 'A'.repeat(64) }]);
  expect(long?.width).toBeGreaterThan(short?.width ?? Infinity);
  expect(long?.height).toBe(short?.height);
});

it('reports invalid SSCC data instead of producing a different identifier', () => {
  expect(() => encodePrintCodes([{ kind: 'sscc', text: '000000000000000018' }])).toThrow();
});
