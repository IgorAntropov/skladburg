import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import {
  type City,
  CityTier,
  type LocalDeliveryProfile,
  LocalDeliveryProfileSchema,
} from '@skladburg/contracts/network/v1/network';

import type { IStateReader } from '../../state/index';
import type { RouteValue } from './routeGraph';

import { SeedCityId } from '../../seed/seedIds';
import {
  createRouteGraph,
  findRoutesFrom,
} from './routeGraph';

const DEMO_CITY_IDS: ReadonlySet<string> = new Set(Object.values(SeedCityId));
const DEMO_PROFILES: ReadonlyMap<CityTier, Pick<LocalDeliveryProfile, 'distanceKm' | 'driveMinutes'>> = new Map([
  [CityTier.LARGE, { distanceKm: 22, driveMinutes: 60 }],
  [CityTier.MEDIUM, { distanceKm: 14, driveMinutes: 40 }],
  [CityTier.SMALL, { distanceKm: 8, driveMinutes: 25 }],
]);

export const withLocalDeliveryProfile = (city: City): City => {
  if (city.localDeliveryProfile !== undefined || !DEMO_CITY_IDS.has(city.id)) {
    return city;
  }
  const profile = DEMO_PROFILES.get(city.tier);

  return profile === undefined ? city : { ...city, localDeliveryProfile: create(LocalDeliveryProfileSchema, profile) };
};

export const findInterWarehouseRoutes = (reader: IStateReader, destination: Warehouse): ReadonlyMap<string, RouteValue> => {
  const { cityId, mapNodeId } = destination;
  const routes = findRoutesFrom(createRouteGraph(reader.list('routeLegs')), mapNodeId);
  const city = reader.get('cities', cityId);
  const profile = city === undefined ? undefined : withLocalDeliveryProfile(city).localDeliveryProfile;
  if (profile === undefined) {
    return routes;
  }

  return new Map(routes).set(mapNodeId, {
    distanceKm: profile.distanceKm,
    driveMinutes: profile.driveMinutes,
    legIds: [],
    mapNodeIds: [mapNodeId],
  });
};
