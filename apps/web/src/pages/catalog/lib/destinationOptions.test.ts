import { create } from '@bufbuild/protobuf';
import {
  type Warehouse,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildDestinationOptions,
  resolveDestination,
} from './destinationOptions';

const warehouse = (id: string, name: string, cityId: string): Warehouse => create(WarehouseSchema, { cityId, id, name });

const CITY_NAMES = new Map([['city-kazan', 'Казань'], ['city-moscow', 'Москва']]);

describe('buildDestinationOptions', () => {
  it('orders the warehouses by name with numbers read as numbers and names the cities', () => {
    const options = buildDestinationOptions(
      [warehouse('w-10', 'Склад 10', 'city-kazan'), warehouse('w-2', 'Склад 2', 'city-moscow')],
      CITY_NAMES,
    );

    expect(options).toEqual([
      { cityName: 'Москва', id: 'w-2', warehouseName: 'Склад 2' },
      { cityName: 'Казань', id: 'w-10', warehouseName: 'Склад 10' },
    ]);
  });

  it('breaks a tie of names by id and leaves the city name empty when the city is unknown', () => {
    const options = buildDestinationOptions(
      [warehouse('b', 'Склад', 'city-unknown'), warehouse('a', 'Склад', 'city-moscow')],
      CITY_NAMES,
    );

    expect(options.map(option => option.id)).toEqual(['a', 'b']);
    expect(options[1]?.cityName).toBe('');
  });
});

describe('resolveDestination', () => {
  const options = buildDestinationOptions(
    [warehouse('w-1', 'Склад 1', 'city-moscow'), warehouse('w-2', 'Склад 2', 'city-kazan')],
    CITY_NAMES,
  );

  it('keeps the saved warehouse while it exists', () => {
    expect(resolveDestination(options, 'w-2')?.id).toBe('w-2');
  });

  it('falls back to the first warehouse when nothing is saved or the saved one is gone', () => {
    expect(resolveDestination(options, undefined)?.id).toBe('w-1');
    expect(resolveDestination(options, 'w-removed')?.id).toBe('w-1');
  });

  it('has no destination without warehouses', () => {
    expect(resolveDestination([], 'w-1')).toBeUndefined();
  });
});
