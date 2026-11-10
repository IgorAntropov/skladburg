import type { NetworkTripActorValue } from '../../model/networkTripActor';
import type {
  LayoutPointValue,
  NetworkSceneCityValue,
  NetworkSceneLayoutValue,
} from '../layout';

import { findNetworkCityTripPath } from './findNetworkCityTripPath';

export interface NetworkTripPathValue {
  distance: number;
  segments: readonly NetworkTripSegmentValue[];
}

type NetworkTripLayoutValue = Pick<NetworkSceneLayoutValue, 'buildings' | 'cities' | 'roads'>;

interface NetworkTripSegmentValue {
  endDistance: number;
  from: LayoutPointValue;
  heading: number;
  length: number;
  to: LayoutPointValue;
}

const SITE_APPROACH_CLEARANCE_METERS = 1.15;
const ROAD_CITY_GATE_LIMIT = 0.48;
const MIN_SEGMENT_LENGTH_METERS = 1e-6;

const readSiteApproaches = (
  layout: NetworkTripLayoutValue,
  siteId: string,
  city: NetworkSceneCityValue,
): readonly LayoutPointValue[] => {
  const building = layout.buildings.find(candidate => candidate.siteId === siteId && candidate.cityId === city.id);

  if (building === undefined) {
    return [city];
  }

  const normalX = Math.sin(building.rotation);
  const normalZ = Math.cos(building.rotation);
  const dot = (city.x - building.x) * normalX + (city.z - building.z) * normalZ;
  const distance = (building.depth / 2 + SITE_APPROACH_CLEARANCE_METERS) * (dot < 0 ? -1 : 1);

  return [
    { x: building.x + normalX * distance, z: building.z + normalZ * distance },
    { x: building.x - normalX * distance, z: building.z - normalZ * distance },
  ];
};

const collectRouteCities = (
  actor: NetworkTripActorValue,
  layout: NetworkTripLayoutValue,
  start: NetworkSceneCityValue,
): readonly NetworkSceneCityValue[] | undefined => {
  const cities = [start];
  let nodeId = actor.fromNodeId;

  for (const legId of actor.routeLegIds) {
    const road = layout.roads.find(candidate => candidate.id === legId);

    if (road?.fromCityId === nodeId) {
      nodeId = road.toCityId;
    }
    else if (road?.toCityId === nodeId) {
      nodeId = road.fromCityId;
    }
    else {
      return undefined;
    }

    const city = layout.cities.find(candidate => candidate.id === nodeId);

    if (city === undefined) {
      return undefined;
    }

    cities.push(city);
  }

  return nodeId === actor.toNodeId ? cities : undefined;
};

const readCityGate = (
  city: NetworkSceneCityValue,
  neighbor: NetworkSceneCityValue,
  layout: NetworkTripLayoutValue,
): LayoutPointValue => {
  const length = Math.hypot(neighbor.x - city.x, neighbor.z - city.z);

  if (length < MIN_SEGMENT_LENGTH_METERS || !layout.buildings.some(building => building.cityId === city.id)) {
    return city;
  }

  const ratio = Math.min(city.radius / length, ROAD_CITY_GATE_LIMIT);

  return { x: city.x + (neighbor.x - city.x) * ratio, z: city.z + (neighbor.z - city.z) * ratio };
};

const collectCityApproaches = (
  actor: NetworkTripActorValue,
  layout: NetworkTripLayoutValue,
  route: readonly NetworkSceneCityValue[],
): readonly LayoutPointValue[] | undefined => {
  const points: LayoutPointValue[] = [];

  for (const [index, city] of route.entries()) {
    const previous = route[index - 1];
    const next = route[index + 1];
    const starts = previous === undefined ? readSiteApproaches(layout, actor.pickupSiteId, city) : [readCityGate(city, previous, layout)];
    const ends = next === undefined ? readSiteApproaches(layout, actor.deliverySiteId, city) : [readCityGate(city, next, layout)];
    const approach = findNetworkCityTripPath(city, layout.buildings, starts, ends);

    if (approach === undefined) {
      return undefined;
    }

    points.push(...approach);
  }

  return points;
};

export const buildNetworkTripPath = (actor: NetworkTripActorValue, layout: NetworkTripLayoutValue): NetworkTripPathValue | undefined => {
  const start = layout.cities.find(city => city.id === actor.fromNodeId);
  const end = layout.cities.find(city => city.id === actor.toNodeId);

  if (start === undefined || end === undefined) {
    return undefined;
  }

  const route = collectRouteCities(actor, layout, start);
  const points = route === undefined ? undefined : collectCityApproaches(actor, layout, route);

  if (points === undefined) {
    return undefined;
  }

  const segments: NetworkTripSegmentValue[] = [];
  let distance = 0;

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];

    if (from === undefined || to === undefined) {
      continue;
    }

    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);

    if (length > MIN_SEGMENT_LENGTH_METERS) {
      distance += length;
      segments.push({ endDistance: distance, from, heading: Math.atan2(dx, dz), length, to });
    }
  }

  return segments.length === 0 ? undefined : { distance, segments };
};
