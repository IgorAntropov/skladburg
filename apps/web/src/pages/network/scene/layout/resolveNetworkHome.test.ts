import {
  describe,
  expect,
  it,
} from 'vitest';

import { createSquareWorld } from '@/shared/3d';

import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from './networkSceneTypes';

import { NETWORK_WORLD_SIZE_METERS } from '../networkWorldConstants';
import {
  HOME_MARGIN_METERS,
  HOME_MIN_RADIUS_METERS,
} from './layoutConstants';
import { getFarthestCornerDistance } from './layoutTestSupport';
import { resolveNetworkHome } from './resolveNetworkHome';

const WORLD = createSquareWorld(NETWORK_WORLD_SIZE_METERS);

const createBuilding = (x: number, z: number, isOwn: boolean): NetworkSceneBuildingValue => ({
  cityId: 'a',
  depth: 1.5,
  height: 1.5,
  id: ['building', String(x), String(z)].join('-'),
  isCompany: true,
  isOwn,
  kind: 'warehouse',
  rank: 0,
  rotation: 0,
  side: 'customer',
  siteId: ['site', String(x), String(z)].join('-'),
  width: 2,
  x,
  z,
});

const createCity = (id: string, x: number, z: number, radius = 6.4): NetworkSceneCityValue => ({
  cityId: id,
  id,
  name: id,
  radius,
  x,
  z,
});

describe('resolveNetworkHome', () => {
  it('encloses the own buildings and ignores the others', () => {
    const own = [createBuilding(-40, -20, true), createBuilding(30, 10, true), createBuilding(-10, 35, true)];
    const home = resolveNetworkHome({ buildings: [...own, createBuilding(80, 80, false)], cities: [] }, WORLD);

    for (const building of own) {
      const reach = getFarthestCornerDistance(building, { x: home.centerX, z: home.centerZ });

      expect(reach).toBeLessThanOrEqual(home.radius - HOME_MARGIN_METERS + 1e-9);
    }

    expect(home.centerX).toBeCloseTo(-5, 0);
    expect(home.radius).toBeLessThan(80);
  });

  it('keeps the minimum radius around a single own building', () => {
    const home = resolveNetworkHome({ buildings: [createBuilding(12, -8, true)], cities: [createCity('a', 12, -8)] }, WORLD);

    expect(home.radius).toBe(HOME_MIN_RADIUS_METERS);
    expect(home.centerX).toBeCloseTo(12, 9);
    expect(home.centerZ).toBeCloseTo(-8, 9);
  });

  it('covers the whole network when nothing is own', () => {
    const cities = [createCity('a', -70, -30), createCity('b', 70, 30), createCity('c', 0, 0)];
    const home = resolveNetworkHome({ buildings: [createBuilding(0, 0, false)], cities }, WORLD);

    for (const city of cities) {
      expect(Math.hypot(city.x - home.centerX, city.z - home.centerZ) + city.radius).toBeLessThanOrEqual(home.radius + 1e-9);
    }

    expect(home.centerX).toBeCloseTo(0, 9);
    expect(home.centerZ).toBeCloseTo(0, 9);
  });

  it('falls back to the default home of the world without cities', () => {
    expect(resolveNetworkHome({ buildings: [], cities: [] }, WORLD)).toEqual({ centerX: 0, centerZ: 0, radius: HOME_MIN_RADIUS_METERS });
  });
});
