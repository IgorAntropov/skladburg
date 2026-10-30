import {
  describe,
  expect,
  it,
} from 'vitest';

import { isGtinValid } from './isGtinValid';

describe('isGtinValid', () => {
  it.each(['20000011', '29999996'])('accepts the eight-digit GTIN %s', (value) => {
    expect(isGtinValid(value)).toBe(true);
  });

  it.each(['200000000004', '299999999994'])('accepts the twelve-digit GTIN %s', (value) => {
    expect(isGtinValid(value)).toBe(true);
  });

  it.each(['2000000000008', '2100000000012', '2999999999991'])('accepts the thirteen-digit GTIN %s', (value) => {
    expect(isGtinValid(value)).toBe(true);
  });

  it.each(['20000000000011', '29999999999998'])('accepts the fourteen-digit GTIN %s', (value) => {
    expect(isGtinValid(value)).toBe(true);
  });

  it.each(['20000012', '200000000005', '2000000000009', '2100000000013', '20000000000012'])(
    'rejects %s with a wrong check digit',
    (value) => {
      expect(isGtinValid(value)).toBe(false);
    },
  );

  it.each(['2100000000021', '2100000000102', '2000000000080'])('rejects %s with changed digits', (value) => {
    expect(isGtinValid(value)).toBe(false);
  });

  it.each(['', '2', '2000001', '200000110', '20000000008', '200000000000008'])('rejects %j by its length', (value) => {
    expect(isGtinValid(value)).toBe(false);
  });

  it.each(['2000000000O08', '2000 00000008', '2000000000008\n', ' 2000000000008', '٢٠٠٠٠٠٠٠٠٠٠٠٨'])(
    'rejects %j with characters other than digits',
    (value) => {
      expect(isGtinValid(value)).toBe(false);
    },
  );
});
