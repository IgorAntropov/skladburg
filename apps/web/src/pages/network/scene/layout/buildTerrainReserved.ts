import type { TerrainReservedValue } from '@/shared/3d';

import type {
  NetworkSceneCityValue,
  NetworkSceneRoadValue,
} from './networkSceneTypes';

import {
  CITY_RESERVE_MARGIN_METERS,
  MINI_CITY_RADIUS_METERS,
  ROAD_SHOULDER_METERS,
  ROAD_WIDTH_METERS,
} from './layoutConstants';
import { compareIds } from './layoutHash';

export const CITY_RESERVE_RADIUS_METERS = MINI_CITY_RADIUS_METERS + CITY_RESERVE_MARGIN_METERS;

export const ROAD_CORRIDOR_WIDTH_METERS = ROAD_WIDTH_METERS + 2 * ROAD_SHOULDER_METERS;

export const buildTerrainReserved = (
  cities: readonly Pick<NetworkSceneCityValue, 'id' | 'x' | 'z'>[],
  roads: readonly NetworkSceneRoadValue[],
): TerrainReservedValue => ({
  areas: cities
    .toSorted((current, prev) => compareIds(current.id, prev.id))
    .map(city => ({ radius: CITY_RESERVE_RADIUS_METERS, x: city.x, z: city.z })),
  corridors: roads
    .toSorted((current, prev) => compareIds(current.id, prev.id))
    .map(road => ({ points: [road.from, road.to], width: ROAD_CORRIDOR_WIDTH_METERS })),
});
