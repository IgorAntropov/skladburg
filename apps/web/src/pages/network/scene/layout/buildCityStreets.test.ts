import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
  NetworkSceneRoadValue,
} from './networkSceneTypes';

import { buildCityStreets } from './buildCityStreets';

const createCity = (id: string, x: number, z: number, radius = 6.4): NetworkSceneCityValue => ({
  cityId: id,
  hiddenSiteIds: [],
  id,
  name: id,
  radius,
  tier: 'medium',
  x,
  z,
});

const createRoad = (from: NetworkSceneCityValue, to: NetworkSceneCityValue): NetworkSceneRoadValue => ({
  from: { x: from.x, z: from.z },
  fromCityId: from.id,
  id: 'link',
  to: { x: to.x, z: to.z },
  toCityId: to.id,
});

const createWarehouse = (cityId: string, rotation: number): NetworkSceneBuildingValue => ({
  cityId,
  depth: 1.5,
  height: 1.5,
  id: 'warehouse',
  isCompany: true,
  isOwn: true,
  kind: 'warehouse',
  rank: 0,
  rotation,
  side: 'customer',
  siteId: 'warehouse',
  width: 2,
  x: 3.2,
  z: -3.2,
});

describe('buildCityStreets', () => {
  it('shares each street between neighboring blocks and links an oblique highway to the boundary', () => {
    const a = createCity('a', 0, 0);
    const b = createCity('b', 32, 16);
    const road = createRoad(a, b);

    const plan = buildCityStreets({ buildings: [], cities: [a, b], roads: [road] });
    const entrance = plan.highways[0];

    expect(plan.streets).toHaveLength(48);
    expect(entrance?.from.x).toBeCloseTo(4.8);
    expect(entrance?.from.z).toBeCloseTo(2.4);
    expect(entrance?.to.x).toBeCloseTo(27.2);
    expect(entrance?.to.z).toBeCloseTo(13.6);
    expect(road.from).toEqual({ x: 0, z: 0 });
    expect(road.to).toEqual({ x: 32, z: 16 });
  });

  it('uses the boundary of extended neighborhoods on the entering axis', () => {
    const a = createCity('a', 0, 6, 8);
    const b = createCity('b', 32, 6);
    const [road] = buildCityStreets({ buildings: [], cities: [a, b], roads: [createRoad(a, b)] }).highways;

    expect(road?.from.x).toBeCloseTo(8);
    expect(road?.from.z).toBeCloseTo(6);
    expect(road?.to.x).toBeCloseTo(27.2);
  });

  it('links the warehouse facade to the street on its outward-facing side', () => {
    const city = createCity('a', 0, 0);
    const warehouse = createWarehouse(city.id, Math.PI / 2);
    const house = { ...warehouse, id: 'house', isCompany: false } satisfies NetworkSceneBuildingValue;
    const [driveway] = buildCityStreets({ buildings: [warehouse, house], cities: [city], roads: [] }).driveways;

    expect(driveway?.from).toEqual({ x: 3.95, z: -3.2 });
    expect(driveway?.curb.x).toBeCloseTo(4.25);
    expect(driveway?.curb.z).toBeCloseTo(-3.2);
    expect(driveway?.to.x).toBeCloseTo(4.8);
    expect(driveway?.to.z).toBeCloseTo(-3.2);
  });
});
