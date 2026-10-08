import {
  describe,
  expect,
  it,
} from 'vitest';

import { catalog } from '../catalogs/ru';
import {
  createTranslate,
  createTranslator,
} from './createTranslator';
import { sanitizeOverrides } from './sanitizeOverrides';

describe('sanitizeOverrides', () => {
  it('keeps valid text and plural overrides', () => {
    const overrides = {
      'units.pallet': { few: '{count} поддона', many: '{count} поддонов', one: '{count} поддон', other: '{count} поддона' },
      'warehouse.placeholder': 'Скоро здесь будет склад',
    };

    expect(sanitizeOverrides(overrides, catalog, 'ru')).toEqual(overrides);
  });

  it('drops keys that are not in the catalog', () => {
    expect(sanitizeOverrides({ 'unknown.key': 'Текст' }, catalog, 'ru')).toEqual({});
  });

  it('drops a string where a plural is expected and the opposite', () => {
    const overrides = {
      'units.pallet': 'поддон',
      'warehouse.placeholder': { other: 'Скоро' },
    };

    expect(sanitizeOverrides(overrides, catalog, 'ru')).toEqual({});
  });

  it('drops plural forms without other or with a non-string form', () => {
    const withoutOther = { 'units.pallet': { one: '{count} поддон' } };
    const withBrokenForm = { 'units.pallet': { one: 1, other: '{count} поддона' } };

    expect(sanitizeOverrides(withoutOther, catalog, 'ru')).toEqual({});
    expect(sanitizeOverrides(withBrokenForm, catalog, 'ru')).toEqual({});
  });

  it('drops values that are neither text nor plural forms', () => {
    const overrides = {
      'units.pallet': ['поддон'],
      'warehouse.placeholder': null,
    };

    expect(sanitizeOverrides(overrides, catalog, 'ru')).toEqual({});
  });

  it('keeps valid entries next to invalid ones', () => {
    const overrides = {
      'unknown.key': 'Текст',
      'warehouse.placeholder': 'Скоро здесь будет склад',
    };

    expect(sanitizeOverrides(overrides, catalog, 'ru')).toEqual({ 'warehouse.placeholder': 'Скоро здесь будет склад' });
  });

  it('returns an empty object for missing overrides', () => {
    expect(sanitizeOverrides(undefined, catalog, 'ru')).toEqual({});
  });

  it('applies a correct plural override', () => {
    const overrides = {
      'units.pallet': { few: '{count} поддона', many: '{count} поддонов', one: '{count} поддон', other: '{count} поддона' },
    };
    const translate = createTranslate(createTranslator({
      layers: [catalog, sanitizeOverrides(overrides, catalog, 'ru')],
      locale: 'ru',
    }));

    expect(translate('units.pallet', { count: 5 })).toBe('5 поддонов');
  });
});

describe('sanitizeOverrides plural categories', () => {
  it('drops a plural that misses a category of the locale', () => {
    const incomplete = { 'units.pallet': { other: '{count} поддона' } };
    const withoutMany = { 'units.pallet': { few: '{count} поддона', one: '{count} поддон', other: '{count} поддона' } };

    expect(sanitizeOverrides(incomplete, catalog, 'ru')).toEqual({});
    expect(sanitizeOverrides(withoutMany, catalog, 'ru')).toEqual({});
  });

  it('drops a plural with a category the locale does not have', () => {
    const withZero = {
      'units.pallet': { few: '{count} а', many: '{count} б', one: '{count} в', other: '{count} г', zero: '{count} д' },
    };
    const withUnknown = {
      'units.pallet': { bogus: 'x', few: '{count} а', many: '{count} б', one: '{count} в', other: '{count} г' },
    };

    expect(sanitizeOverrides(withZero, catalog, 'ru')).toEqual({});
    expect(sanitizeOverrides(withUnknown, catalog, 'ru')).toEqual({});
  });
});

describe('sanitizeOverrides placeholders', () => {
  const pluralOverride = (text: string): Record<string, unknown> => ({
    'units.pallet': { few: text, many: text, one: text, other: text },
  });

  it('drops a text with a foreign placeholder', () => {
    expect(sanitizeOverrides({ 'warehouse.placeholder': 'Привет {name}' }, catalog, 'ru')).toEqual({});
  });

  it('drops a plural with a foreign, extra or missing placeholder', () => {
    expect(sanitizeOverrides(pluralOverride('{amount} поддонов'), catalog, 'ru')).toEqual({});
    expect(sanitizeOverrides(pluralOverride('{count} из {total} поддонов'), catalog, 'ru')).toEqual({});
    expect(sanitizeOverrides(pluralOverride('поддонов'), catalog, 'ru')).toEqual({});
  });

  it('drops a plural when only one form has a foreign placeholder', () => {
    const overrides = {
      'units.pallet': { few: '{count} а', many: '{name} б', one: '{count} в', other: '{count} г' },
    };

    expect(sanitizeOverrides(overrides, catalog, 'ru')).toEqual({});
  });

  it('keeps a plural whose forms use the same placeholders in another order or count', () => {
    const overrides = {
      'units.pallet': { few: 'поддонов: {count}', many: '{count} {count}', one: '{count}', other: 'всего {count}' },
    };

    expect(sanitizeOverrides(overrides, catalog, 'ru')).toEqual(overrides);
  });
});

describe('sanitizeOverrides with malformed input', () => {
  it('returns an empty object for non-object overrides', () => {
    expect(sanitizeOverrides('text', catalog, 'ru')).toEqual({});
    expect(sanitizeOverrides(null, catalog, 'ru')).toEqual({});
    expect(sanitizeOverrides([], catalog, 'ru')).toEqual({});
  });
});
