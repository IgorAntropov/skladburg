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

import type { WarehousePlacesValue } from '../model/warehousePlacesTypes';

import { resolveWarehousePlacement } from './resolveWarehousePlacement';

const createPlaces = (nodeSpecs: readonly (readonly [string, string])[]): WarehousePlacesValue => ({
  boardNodes: nodeSpecs.map(([id, cityId]) => create(BoardNodeSchema, { cityId, id })),
  cities: [
    create(CitySchema, { id: 'city-a', name: 'Альфа', timeZone: 'Europe/Moscow' }),
    create(CitySchema, { id: 'city-b', name: 'Бета', timeZone: 'Asia/Yekaterinburg' }),
  ],
});

describe('resolveWarehousePlacement', () => {
  it('takes the board node and the time zone of the city', () => {
    const places = createPlaces([['node-1', 'city-a'], ['node-2', 'city-b']]);

    expect(resolveWarehousePlacement('city-b', places)).toEqual({ boardNodeId: 'node-2', timeZone: 'Asia/Yekaterinburg' });
  });

  it('takes the first board node by id when the city has several', () => {
    const places = createPlaces([['node-3', 'city-a'], ['node-1', 'city-a'], ['node-2', 'city-a']]);

    expect(resolveWarehousePlacement('city-a', places)).toEqual({ boardNodeId: 'node-1', timeZone: 'Europe/Moscow' });
  });

  it('returns nothing when the city is unknown', () => {
    const places = createPlaces([['node-1', 'city-a']]);

    expect(resolveWarehousePlacement('city-x', places)).toBeUndefined();
  });

  it('returns nothing when the city has no board node', () => {
    const places = createPlaces([['node-1', 'city-a']]);

    expect(resolveWarehousePlacement('city-b', places)).toBeUndefined();
  });
});
