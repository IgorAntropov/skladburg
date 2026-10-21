import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkSceneRoadValue } from './networkSceneTypes';

import {
  buildTerrainReserved,
  CITY_RESERVE_RADIUS_METERS,
  ROAD_CORRIDOR_WIDTH_METERS,
} from './buildTerrainReserved';
import { MINI_CITY_RADIUS_METERS } from './layoutConstants';

const CITIES = [
  { id: 'c', x: 40, z: 0 },
  { id: 'a', x: -40, z: 10 },
  { id: 'b', x: 0, z: -30 },
];

const createRoad = (id: string, from: string, to: string): NetworkSceneRoadValue => {
  const fromCity = CITIES.find(city => city.id === from);
  const toCity = CITIES.find(city => city.id === to);

  return {
    from: { x: fromCity?.x ?? 0, z: fromCity?.z ?? 0 },
    fromCityId: from,
    id,
    to: { x: toCity?.x ?? 0, z: toCity?.z ?? 0 },
    toCityId: to,
  };
};

describe('buildTerrainReserved', () => {
  it('reserves a clearing larger than the mini city for every city, ordered by id', () => {
    const { areas } = buildTerrainReserved(CITIES, []);

    expect(areas.map(area => area.x)).toEqual([-40, 0, 40]);
    expect(areas.every(area => area.radius === CITY_RESERVE_RADIUS_METERS)).toBe(true);
    expect(CITY_RESERVE_RADIUS_METERS).toBeGreaterThan(MINI_CITY_RADIUS_METERS);
  });

  it('reserves a corridor between the city centers for every road, ordered by id', () => {
    const { corridors } = buildTerrainReserved(CITIES, [createRoad('r2', 'b', 'c'), createRoad('r1', 'a', 'b')]);

    expect(corridors).toEqual([
      { points: [{ x: -40, z: 10 }, { x: 0, z: -30 }], width: ROAD_CORRIDOR_WIDTH_METERS },
      { points: [{ x: 0, z: -30 }, { x: 40, z: 0 }], width: ROAD_CORRIDOR_WIDTH_METERS },
    ]);
  });

  it('gives the same reserve for the same cities and roads in any order', () => {
    const roads = [createRoad('r1', 'a', 'b'), createRoad('r2', 'b', 'c')];

    expect(buildTerrainReserved(CITIES.toReversed(), roads.toReversed())).toEqual(buildTerrainReserved(CITIES, roads));
  });

  it('reserves nothing for an empty network', () => {
    expect(buildTerrainReserved([], [])).toEqual({ areas: [], corridors: [] });
  });
});
