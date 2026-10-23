import type {
  NetworkCityTierValue,
  NetworkMapCityValue,
  NetworkMapModelValue,
  NetworkMapRoadValue,
  NetworkMapSiteValue,
} from '@/entities/network';

import type {
  LayoutPointValue,
  NetworkSceneBuildingValue,
} from './networkSceneTypes';

import { getBuildingFootprint } from './buildingFootprint';

const SEPARATION_EPSILON = 1e-9;

export const createTestCity = (
  id: string,
  column: number,
  row: number,
  tier: NetworkCityTierValue = 'medium',
): NetworkMapCityValue => ({
  cityId: `${id}-city`,
  id,
  name: `City ${id}`,
  position: { column, row },
  siteIds: [],
  tier,
  timeZone: 'Europe/Moscow',
});

export const createTestRoad = (id: string, fromNodeId: string, toNodeId: string): NetworkMapRoadValue => ({
  distanceKm: 100,
  driveMinutes: 80,
  fromNodeId,
  id,
  toNodeId,
});

export const createTestSite = (id: string, nodeId: string, isOwn = false): NetworkMapSiteValue => ({
  cityId: `${nodeId}-city`,
  id,
  isOwn,
  label: `Site ${id}`,
  nodeId,
  organizationId: 'organization',
  organizationName: 'Company',
  side: 'customer',
});

export const createTestModel = (
  cities: readonly NetworkMapCityValue[],
  roads: readonly NetworkMapRoadValue[] = [],
  sites: readonly NetworkMapSiteValue[] = [],
): NetworkMapModelValue => ({ cities, roads, sites });

const getAxes = (corners: readonly LayoutPointValue[]): LayoutPointValue[] => corners.map((corner, index) => {
  const next = corners[(index + 1) % corners.length] ?? corner;

  return { x: corner.z - next.z, z: next.x - corner.x };
});

const projectOnAxis = (corners: readonly LayoutPointValue[], axis: LayoutPointValue): { max: number; min: number } => {
  const values = corners.map(corner => corner.x * axis.x + corner.z * axis.z);

  return { max: Math.max(...values), min: Math.min(...values) };
};

export const areBuildingsOverlapping = (
  current: Pick<NetworkSceneBuildingValue, 'depth' | 'rotation' | 'width' | 'x' | 'z'>,
  prev: Pick<NetworkSceneBuildingValue, 'depth' | 'rotation' | 'width' | 'x' | 'z'>,
): boolean => {
  const currentCorners = getBuildingFootprint(current);
  const prevCorners = getBuildingFootprint(prev);

  return ![...getAxes(currentCorners), ...getAxes(prevCorners)].some((axis) => {
    const currentRange = projectOnAxis(currentCorners, axis);
    const prevRange = projectOnAxis(prevCorners, axis);

    return currentRange.max <= prevRange.min + SEPARATION_EPSILON || prevRange.max <= currentRange.min + SEPARATION_EPSILON;
  });
};

export const getFarthestCornerDistance = (
  building: Pick<NetworkSceneBuildingValue, 'depth' | 'rotation' | 'width' | 'x' | 'z'>,
  center: LayoutPointValue,
): number => Math.max(...getBuildingFootprint(building).map(corner => Math.hypot(corner.x - center.x, corner.z - center.z)));

export const getSegmentDistance = (point: LayoutPointValue, from: LayoutPointValue, to: LayoutPointValue): number => {
  const directionX = to.x - from.x;
  const directionZ = to.z - from.z;
  const lengthSquared = directionX * directionX + directionZ * directionZ;
  const projection = lengthSquared > 0 ? ((point.x - from.x) * directionX + (point.z - from.z) * directionZ) / lengthSquared : 0;
  const clamped = Math.min(1, Math.max(0, projection));

  return Math.hypot(point.x - (from.x + directionX * clamped), point.z - (from.z + directionZ * clamped));
};

export const getBuildingSlotKey = (building: Pick<NetworkSceneBuildingValue, 'x' | 'z'>): string => [building.x, building.z].join(':');
