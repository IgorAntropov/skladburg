import {
  describe,
  expect,
  it,
} from 'vitest';

import { findDemoWarehouseAddresses } from './findDemoWarehouseAddresses';

describe('findDemoWarehouseAddresses', () => {
  it('filters by city and matches the street and house fragments regardless of case and punctuation', () => {
    expect(findDemoWarehouseAddresses('Казань', 'РЯБИНОВЫХ, 14')).toEqual(['ул. Рябиновых Фонарей, 14']);
    expect(findDemoWarehouseAddresses('Москва', 'РЯБИНОВЫХ, 14')).toEqual([]);
    expect(findDemoWarehouseAddresses('Москва', 'ряби')).toEqual(['ул. Рябиновых Маяков, 6']);
  });

  it('matches е when the street contains ё', () => {
    expect(findDemoWarehouseAddresses('Казань', 'кленовых')).toEqual(['проезд Клёновых Контейнеров, 3']);
  });

  it('provides no suggestions for a missing city, short input or unknown address', () => {
    expect(findDemoWarehouseAddresses(undefined, 'ряби')).toEqual([]);
    expect(findDemoWarehouseAddresses('Томск', 'ряби')).toEqual([]);
    expect(findDemoWarehouseAddresses('Казань', 'р.')).toEqual([]);
    expect(findDemoWarehouseAddresses('Казань', '...')).toEqual([]);
    expect(findDemoWarehouseAddresses('Казань', 'ручной адрес')).toEqual([]);
  });
});
