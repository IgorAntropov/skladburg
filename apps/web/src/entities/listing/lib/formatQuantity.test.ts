import type { PriceUnit } from '@skladburg/contracts/catalog/v1/catalog';

import { create } from '@bufbuild/protobuf';
import { PriceUnitSchema } from '@skladburg/contracts/catalog/v1/catalog';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { formatQuantity } from './formatQuantity';

const createPriceUnit = (name: string, baseQuantity: bigint): PriceUnit => create(PriceUnitSchema, { baseQuantity, name });

const KILOGRAM = createPriceUnit('кг', 1000n);
const PIECE = createPriceUnit('шт', 1n);

describe('formatQuantity', () => {
  it('writes a multiple of the price unit in price units', () => {
    expect(formatQuantity('ru', 480000n, KILOGRAM, 'г')).toBe('480\u00a0кг');
  });

  it('groups thousands with no-break spaces', () => {
    expect(formatQuantity('ru', 17280000n, KILOGRAM, 'г')).toBe('17\u00a0280\u00a0кг');
  });

  it('groups thousands by the rules of the locale', () => {
    expect(formatQuantity('en', 17280000n, KILOGRAM, 'г')).toBe('17,280\u00a0кг');
  });

  it('writes a quantity that is not a multiple in base units', () => {
    expect(formatQuantity('ru', 480500n, KILOGRAM, 'г')).toBe('480\u00a0500\u00a0г');
  });

  it('keeps pieces as they are when the price unit is the base unit', () => {
    expect(formatQuantity('ru', 12n, PIECE, 'шт')).toBe('12\u00a0шт');
  });

  it('writes zero in price units', () => {
    expect(formatQuantity('ru', 0n, KILOGRAM, 'г')).toBe('0\u00a0кг');
  });

  it('falls back to base units when the price unit has no base quantity', () => {
    expect(formatQuantity('ru', 480n, createPriceUnit('кг', 0n), 'г')).toBe('480\u00a0г');
  });

  it('keeps every digit around 10^10', () => {
    expect(formatQuantity('ru', 10000000000n, PIECE, 'шт')).toBe('10\u00a0000\u00a0000\u00a0000\u00a0шт');
    expect(formatQuantity('ru', 10000000001n, KILOGRAM, 'г')).toBe('10\u00a0000\u00a0000\u00a0001\u00a0г');
    expect(formatQuantity('ru', 10000000000000n, KILOGRAM, 'г')).toBe('10\u00a0000\u00a0000\u00a0000\u00a0кг');
  });

  it('keeps every digit above the safe integer range', () => {
    expect(formatQuantity('ru', 9007199254740993n, PIECE, 'шт')).toBe('9\u00a0007\u00a0199\u00a0254\u00a0740\u00a0993\u00a0шт');
  });
});
