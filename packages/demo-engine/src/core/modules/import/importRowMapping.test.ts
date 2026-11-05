import {
  describe,
  expect,
  it,
} from 'vitest';

import { parseImportMoney } from './importRowMapping';

describe('parseImportMoney', () => {
  it('uses exact minor units from decimal strings', () => {
    expect(parseImportMoney('88259496234518.57')).toBe(8825949623451857n);
    expect(parseImportMoney('12,5')).toBe(1250n);
  });
  it.each(['1e3', 'NaN', '1.234', '-1', '9999999999999999999999'])('rejects unsupported money %s', (value) => {
    expect(() => parseImportMoney(value)).toThrow();
  });
});
