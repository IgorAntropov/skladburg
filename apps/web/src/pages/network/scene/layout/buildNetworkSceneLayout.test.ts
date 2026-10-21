import {
  describe,
  expect,
  it,
} from 'vitest';

import { NETWORK_WORLD_SIZE_METERS } from '../networkWorldConstants';
import { getVisibleBuildingCount } from './buildingVisibility';
import { buildNetworkSceneLayout } from './buildNetworkSceneLayout';
import { HOME_MIN_RADIUS_METERS } from './layoutConstants';
import {
  createTestCity,
  createTestModel,
  createTestRoad,
  createTestSite,
} from './layoutTestSupport';

const CITIES = [createTestCity('a', 4, 2), createTestCity('b', 7, 3), createTestCity('c', 5, 6)];
const ROADS = [createTestRoad('r1', 'a', 'b'), createTestRoad('r2', 'b', 'c')];

describe('buildNetworkSceneLayout', () => {
  it('returns the same layout object for the same model object', () => {
    const model = createTestModel(CITIES, ROADS);

    expect(buildNetworkSceneLayout(model)).toBe(buildNetworkSceneLayout(model));
    expect(buildNetworkSceneLayout(createTestModel(CITIES, ROADS))).not.toBe(buildNetworkSceneLayout(model));
  });

  it('lays out cities, roads and the world', () => {
    const layout = buildNetworkSceneLayout(createTestModel(CITIES, ROADS));

    expect(layout.cities.map(city => city.id)).toEqual(['a', 'b', 'c']);
    expect(layout.roads.map(road => road.id)).toEqual(['r1', 'r2']);
    expect(layout.roads[0]).toMatchObject({ fromCityId: 'a', toCityId: 'b' });
    expect(layout.world.home).toBe(layout.home);
    expect(layout.world.bounds.maxX).toBe(NETWORK_WORLD_SIZE_METERS / 2);
  });

  it('skips a road with an unknown end, in the roads and in the corridors', () => {
    const layout = buildNetworkSceneLayout(createTestModel(CITIES, [...ROADS, createTestRoad('r3', 'c', 'ghost')]));

    expect(layout.roads.map(road => road.id)).toEqual(['r1', 'r2']);
    expect(layout.terrainReserved.corridors).toHaveLength(2);
  });

  it('ignores a site in an unknown city', () => {
    const layout = buildNetworkSceneLayout(createTestModel(CITIES, ROADS, [createTestSite('s1', 'ghost', true)]));

    expect(layout.buildings.some(building => building.isCompany)).toBe(false);
    expect(layout.home.radius).toBeGreaterThanOrEqual(HOME_MIN_RADIUS_METERS);
  });

  it('keeps the terrain reserve when the sites change or the data comes in another order', () => {
    const empty = buildNetworkSceneLayout(createTestModel(CITIES, ROADS));
    const withSites = buildNetworkSceneLayout(createTestModel(
      CITIES.toReversed(),
      ROADS.toReversed(),
      [createTestSite('s1', 'a', true), createTestSite('s2', 'a'), createTestSite('s3', 'b')],
    ));

    expect(JSON.stringify(withSites.terrainReserved)).toBe(JSON.stringify(empty.terrainReserved));
    expect(empty.terrainReserved.areas).toHaveLength(3);
    expect(empty.terrainReserved.corridors).toHaveLength(2);
  });

  it('puts company buildings before decor and keeps decor sorted by rank', () => {
    const { buildings } = buildNetworkSceneLayout(createTestModel(
      CITIES,
      ROADS,
      [createTestSite('s1', 'a', true), createTestSite('s2', 'b'), createTestSite('s3', 'b')],
    ));
    const companyCount = buildings.filter(building => building.isCompany).length;

    expect(companyCount).toBe(3);
    expect(buildings.slice(0, companyCount).every(building => building.isCompany)).toBe(true);

    const ranks = buildings.slice(companyCount).map(building => building.rank);

    expect(ranks).toEqual(ranks.toSorted((current, prev) => current - prev));
  });

  it('keeps every company building and about the density share of decor at each quality level', () => {
    const cities = Array.from(
      { length: 24 },
      (_, index) => createTestCity(['city', String(index)].join('-'), index % 6, Math.floor(index / 6)),
    );
    const { buildings } = buildNetworkSceneLayout(createTestModel(cities, [], [createTestSite('s1', 'city-3', true)]));
    const decorCount = buildings.filter(building => !building.isCompany).length;

    for (const density of [0.3, 0.6, 1]) {
      const visible = getVisibleBuildingCount(buildings, density);

      expect(visible).toBeGreaterThanOrEqual(1);
      expect(Math.abs((visible - 1) / decorCount - density)).toBeLessThan(0.08);
    }
  });

  it('lays out an empty model with the default home', () => {
    const layout = buildNetworkSceneLayout(createTestModel([]));

    expect(layout.buildings).toEqual([]);
    expect(layout.terrainReserved).toEqual({ areas: [], corridors: [] });
    expect(layout.home).toEqual({ centerX: 0, centerZ: 0, radius: HOME_MIN_RADIUS_METERS });
  });
});
