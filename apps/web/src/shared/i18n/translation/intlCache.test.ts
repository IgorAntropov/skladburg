import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getDateTimeFormat,
  getNumberFormat,
  getPluralRules,
} from './intlCache';

describe('intlCache', () => {
  it('returns the same number format for the same locale and options', () => {
    expect(getNumberFormat('ru')).toBe(getNumberFormat('ru'));
    expect(getNumberFormat('ru', { currency: 'RUB', style: 'currency' })).toBe(
      getNumberFormat('ru', { currency: 'RUB', style: 'currency' }),
    );
  });

  it('returns different number formats for different locales and options', () => {
    expect(getNumberFormat('ru')).not.toBe(getNumberFormat('en'));
    expect(getNumberFormat('ru')).not.toBe(getNumberFormat('ru', { style: 'percent' }));
  });

  it('caches date formats', () => {
    expect(getDateTimeFormat('ru', { timeZone: 'UTC' })).toBe(getDateTimeFormat('ru', { timeZone: 'UTC' }));
    expect(getDateTimeFormat('ru', { timeZone: 'UTC' })).not.toBe(getDateTimeFormat('ru', { timeZone: 'Asia/Omsk' }));
  });

  it('caches plural rules per locale', () => {
    expect(getPluralRules('ru')).toBe(getPluralRules('ru'));
    expect(getPluralRules('ru')).not.toBe(getPluralRules('en'));
  });
});
