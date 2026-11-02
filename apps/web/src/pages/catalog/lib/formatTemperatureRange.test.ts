import { create } from '@bufbuild/protobuf';
import {
  type TemperatureRange,
  TemperatureRangeSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { formatTemperatureRange } from './formatTemperatureRange';

const range = (minCelsius: number, maxCelsius: number): TemperatureRange => create(TemperatureRangeSchema, { maxCelsius, minCelsius });

describe('formatTemperatureRange', () => {
  it('writes the plus sign, the real minus sign and the unit after a no-break space', () => {
    expect(formatTemperatureRange(range(2, 6))).toBe('+2…+6\u00a0°C');
    expect(formatTemperatureRange(range(-18, -12))).toBe('\u221218…\u221212\u00a0°C');
    expect(formatTemperatureRange(range(-2, 4))).toBe('\u22122…+4\u00a0°C');
  });

  it('writes zero without a sign and collapses a range of one value', () => {
    expect(formatTemperatureRange(range(0, 5))).toBe('0…+5\u00a0°C');
    expect(formatTemperatureRange(range(4, 4))).toBe('+4\u00a0°C');
  });

  it('has no text without a range', () => {
    expect(formatTemperatureRange(undefined)).toBeUndefined();
  });
});
