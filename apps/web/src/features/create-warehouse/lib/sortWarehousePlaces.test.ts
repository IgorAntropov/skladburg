import { create } from '@bufbuild/protobuf';
import {
  CitySchema,
  MapNodeSchema,
} from '@skladburg/contracts/network/v1/network';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { sortWarehousePlaces } from './sortWarehousePlaces';

describe('sortWarehousePlaces', () => {
  it('sorts the cities by name in the locale order and keeps the map nodes', () => {
    const mapNodes = [create(MapNodeSchema, { cityId: 'c', id: 'n' })];
    const cities = ['Ярославль', 'Ёлкино', 'Воронеж', 'Екатеринбург'].map(name => create(CitySchema, { id: name, name }));

    const sorted = sortWarehousePlaces({ cities, mapNodes }, 'ru');

    expect(sorted.cities.map(city => city.name)).toEqual(['Воронеж', 'Екатеринбург', 'Ёлкино', 'Ярославль']);
    expect(sorted.mapNodes).toBe(mapNodes);
    expect(cities[0]?.name).toBe('Ярославль');
  });
});
