import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
  NetworkSceneLayoutValue,
  NetworkSceneRoadValue,
} from '../layout';

import { buildNetworkSceneLayout } from '../layout';
import {
  createTestCity,
  createTestModel,
  createTestRoad,
  createTestSite,
} from '../layout/layoutTestSupport';

export const createBuilding = (overrides: Partial<NetworkSceneBuildingValue>): NetworkSceneBuildingValue => ({
  cityId: 'city',
  depth: 1.2,
  height: 1.4,
  id: 'building',
  isCompany: false,
  isOwn: false,
  kind: 'house',
  rank: 0.5,
  rotation: 0,
  side: undefined,
  siteId: undefined,
  width: 1.4,
  x: 10,
  z: -6,
  ...overrides,
});

export const createCity = (id: string, x: number, z: number, radius = 6.4): NetworkSceneCityValue => ({
  cityId: `${id}-city`,
  hiddenSiteIds: [],
  id,
  name: id,
  radius,
  x,
  z,
});

export const createRoad = (id: string, from: NetworkSceneCityValue, to: NetworkSceneCityValue): NetworkSceneRoadValue => ({
  from: { x: from.x, z: from.z },
  fromCityId: from.id,
  id,
  to: { x: to.x, z: to.z },
  toCityId: to.id,
});

const SAMPLE_CITIES = [
  createTestCity('a', 2, 2),
  createTestCity('b', 6, 3),
  createTestCity('c', 4, 7),
  createTestCity('d', 9, 8),
  createTestCity('e', 1, 8),
  createTestCity('f', 8, 1),
];

const SAMPLE_ROADS = [
  createTestRoad('r1', 'a', 'b'),
  createTestRoad('r2', 'b', 'c'),
  createTestRoad('r3', 'a', 'c'),
  createTestRoad('r4', 'c', 'd'),
  createTestRoad('r5', 'c', 'e'),
  createTestRoad('r6', 'b', 'f'),
  createTestRoad('r7', 'b', 'd'),
];

const SAMPLE_SITES = SAMPLE_CITIES.map(city => createTestSite(`site-${city.id}`, city.id, city.id === 'a'));

export const buildSampleLayout = (): NetworkSceneLayoutValue =>
  buildNetworkSceneLayout(createTestModel(SAMPLE_CITIES, SAMPLE_ROADS, SAMPLE_SITES));
