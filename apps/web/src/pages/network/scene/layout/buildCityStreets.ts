import type {
  LayoutPointValue,
  NetworkSceneBuildingValue,
  NetworkSceneLayoutValue,
  NetworkSceneRoadValue,
} from './networkSceneTypes';

import { MINI_CITY_SLOT_PITCH_METERS } from './layoutConstants';
import { getMiniCitySlots } from './miniCitySlots';

export interface CityStreetsValue {
  driveways: readonly CityDrivewayValue[];
  highways: readonly NetworkSceneRoadValue[];
  streets: readonly CityStreetValue[];
}

export interface CityStreetValue {
  from: LayoutPointValue;
  to: LayoutPointValue;
}

interface CityDrivewayValue extends CityStreetValue {
  curb: LayoutPointValue;
}

export const CITY_STREET_WIDTH_METERS = 1.1;

export const CITY_LOT_WIDTH_METERS = MINI_CITY_SLOT_PITCH_METERS - CITY_STREET_WIDTH_METERS;

export const CITY_DRIVEWAY_WIDTH_METERS = 0.84;

const HALF_BLOCK = MINI_CITY_SLOT_PITCH_METERS / 2;
const MAX_ENTRANCE_SHARE = 0.48;

const readCityEdges = (city: LayoutPointValue, radius: number): readonly CityStreetValue[] => {
  const edges = new Map<string, CityStreetValue>();

  for (const slot of getMiniCitySlots(radius)) {
    const left = slot.x - HALF_BLOCK;
    const right = slot.x + HALF_BLOCK;
    const top = slot.z - HALF_BLOCK;
    const bottom = slot.z + HALF_BLOCK;
    const rows = [
      [left, top, right, top],
      [left, bottom, right, bottom],
      [left, top, left, bottom],
      [right, top, right, bottom],
    ] as const;

    for (const [x1, z1, x2, z2] of rows) {
      const key = [x1, z1, x2, z2].map(value => Math.round(value / HALF_BLOCK)).join('|');

      if (!edges.has(key)) {
        edges.set(key, {
          from: { x: city.x + x1, z: city.z + z1 },
          to: { x: city.x + x2, z: city.z + z2 },
        });
      }
    }
  }

  return [...edges.values()];
};

const readCrossing = (from: LayoutPointValue, to: LayoutPointValue, street: CityStreetValue): number => {
  const isHorizontal = street.from.z === street.to.z;
  const delta = isHorizontal ? to.z - from.z : to.x - from.x;

  if (delta === 0) {
    return 0;
  }

  const along = isHorizontal ? street.from.z - from.z : street.from.x - from.x;
  const fraction = along / delta;

  if (fraction <= 0 || fraction > MAX_ENTRANCE_SHARE) {
    return 0;
  }

  const across = isHorizontal ? from.x + (to.x - from.x) * fraction : from.z + (to.z - from.z) * fraction;
  const start = isHorizontal ? street.from.x : street.from.z;
  const end = isHorizontal ? street.to.x : street.to.z;

  return across >= start && across <= end ? fraction : 0;
};

const readCityEntrance = (
  from: LayoutPointValue,
  to: LayoutPointValue,
  streets: readonly CityStreetValue[],
): LayoutPointValue => {
  const share = streets.reduce((point, street) => Math.max(point, readCrossing(from, to, street)), 0);

  return { x: from.x + (to.x - from.x) * share, z: from.z + (to.z - from.z) * share };
};

const readDriveway = (building: NetworkSceneBuildingValue, city: LayoutPointValue): CityDrivewayValue => {
  const xDirection = Math.round(Math.sin(building.rotation));
  const zDirection = Math.round(Math.cos(building.rotation));
  const pointsOutward = (building.x - city.x) * xDirection + (building.z - city.z) * zDirection >= 0;
  const direction = pointsOutward ? 1 : -1;
  const x = xDirection * direction;
  const z = zDirection * direction;
  const curbDistance = CITY_LOT_WIDTH_METERS / 2;

  return {
    curb: { x: building.x + x * curbDistance, z: building.z + z * curbDistance },
    from: { x: building.x + x * building.depth / 2, z: building.z + z * building.depth / 2 },
    to: { x: building.x + x * HALF_BLOCK, z: building.z + z * HALF_BLOCK },
  };
};

export const buildCityStreets = (layout: Pick<NetworkSceneLayoutValue, 'buildings' | 'cities' | 'roads'>): CityStreetsValue => {
  const streetsByCity = new Map(layout.cities.map(city => [city.id, readCityEdges(city, city.radius)]));
  const cityById = new Map(layout.cities.map(city => [city.id, city]));
  const highways = layout.roads.map(road => ({
    ...road,
    from: readCityEntrance(road.from, road.to, streetsByCity.get(road.fromCityId) ?? []),
    to: readCityEntrance(road.to, road.from, streetsByCity.get(road.toCityId) ?? []),
  }));
  const driveways = layout.buildings.flatMap((building) => {
    const city = building.isCompany ? cityById.get(building.cityId) : undefined;

    return city === undefined ? [] : [readDriveway(building, city)];
  });

  return { driveways, highways, streets: [...streetsByCity.values()].flat() };
};
