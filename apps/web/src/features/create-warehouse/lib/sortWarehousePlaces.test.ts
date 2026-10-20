import { create } from '@bufbuild/protobuf';
import {
  BoardNodeSchema,
  CitySchema,
} from '@skladburg/contracts/network/v1/network';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { sortWarehousePlaces } from './sortWarehousePlaces';

describe('sortWarehousePlaces', () => {
  it('sorts the cities by name in the locale order and keeps the board nodes', () => {
    const boardNodes = [create(BoardNodeSchema, { cityId: 'c', id: 'n' })];
    const cities = ['Ярославль', 'Ёлкино', 'Воронеж', 'Екатеринбург'].map(name => create(CitySchema, { id: name, name }));

    const sorted = sortWarehousePlaces({ boardNodes, cities }, 'ru');

    expect(sorted.cities.map(city => city.name)).toEqual(['Воронеж', 'Екатеринбург', 'Ёлкино', 'Ярославль']);
    expect(sorted.boardNodes).toBe(boardNodes);
    expect(cities[0]?.name).toBe('Ярославль');
  });
});
