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

const translateRu = createTranslate(createTranslator({ layers: [catalog], locale: 'ru' }));

describe('createTranslate with the ru catalog', () => {
  it.each([
    [0, '0 паллет'],
    [1, '1 паллета'],
    [2, '2 паллеты'],
    [5, '5 паллет'],
    [11, '11 паллет'],
    [21, '21 паллета'],
    [22, '22 паллеты'],
    [25, '25 паллет'],
    [111, '111 паллет'],
    [112, '112 паллет'],
    [1.5, '1,5 паллеты'],
  ])('pluralizes %s', (count, expected) => {
    expect(translateRu('units.pallet', { count })).toBe(expected);
  });

  it('formats the count with the locale grouping', () => {
    expect(translateRu('units.pallet', { count: 1000 })).toMatch(/^1\s000 паллет$/u);
  });

  it('returns a plain message', () => {
    expect(translateRu('warehouse.placeholder')).toBe('Здесь скоро появится живой мир');
  });
});

describe('createTranslator', () => {
  it('returns the key when the message is missing', () => {
    const translate = createTranslator({ layers: [catalog], locale: 'ru' });

    expect(translate('missing.key')).toBe('missing.key');
  });

  it('does not resolve inherited object properties', () => {
    const translate = createTranslator({ layers: [catalog], locale: 'ru' });

    expect(translate('toString')).toBe('toString');
  });

  it('lets a later layer win over an earlier one', () => {
    const translate = createTranslator({
      layers: [
        { 'dock.title': 'Dock', 'gate.title': 'Gate' },
        { 'dock.title': 'Bay' },
        {},
      ],
      locale: 'en',
    });

    expect(translate('dock.title')).toBe('Bay');
    expect(translate('gate.title')).toBe('Gate');
  });

  it('keeps an unknown placeholder and substitutes known ones', () => {
    const translate = createTranslator({
      layers: [{ 'visit.title': 'Visit {number} of {total}' }],
      locale: 'en',
    });

    expect(translate('visit.title', { number: 3 })).toBe('Visit 3 of {total}');
  });

  it('keeps placeholders when no params are passed', () => {
    const translate = createTranslator({ layers: [{ 'visit.title': 'Visit {number}' }], locale: 'en' });

    expect(translate('visit.title')).toBe('Visit {number}');
  });

  it('inserts string params as is and formats numbers by locale', () => {
    const translate = createTranslator({ layers: [{ 'stock.line': '{name}: {amount}' }], locale: 'ru' });

    expect(translate('stock.line', { amount: 1234.5, name: '1000' })).toMatch(/^1000: 1\s234,5$/u);
  });

  it('falls back to the other form when the needed form is missing', () => {
    const translate = createTranslator({
      layers: [{ 'unit.box': { other: '{count} boxes' } }],
      locale: 'ru',
    });

    expect(translate('unit.box', { count: 1 })).toBe('1 boxes');
  });

  it('uses the other form when the count is not a number', () => {
    const translate = createTranslator({
      layers: [{ 'unit.box': { one: '{count} box', other: '{count} boxes' } }],
      locale: 'en',
    });

    expect(translate('unit.box', { count: 'many' })).toBe('many boxes');
    expect(translate('unit.box')).toBe('{count} boxes');
  });

  it('selects the plural form by the locale of the translator', () => {
    const translate = createTranslator({
      layers: [{ 'unit.box': { one: '{count} box', other: '{count} boxes' } }],
      locale: 'en',
    });

    expect(translate('unit.box', { count: 1 })).toBe('1 box');
    expect(translate('unit.box', { count: 2 })).toBe('2 boxes');
  });
});
