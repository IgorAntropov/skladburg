import { create } from '@bufbuild/protobuf';
import {
  type City,
  CitySchema,
  CityTier,
  type MapNode,
  MapNodeSchema,
  type RouteLeg,
  RouteLegSchema,
} from '@skladburg/contracts/network/v1/network';

import {
  SeedCityId,
  SeedMapNodeId,
  SeedRouteLegId,
} from './seedIds';

export const MOSCOW_TIME_ZONE = 'Europe/Moscow';
export const YEKATERINBURG_TIME_ZONE = 'Asia/Yekaterinburg';
export const NOVOSIBIRSK_TIME_ZONE = 'Asia/Novosibirsk';

interface SeedCityDefinitionValue {
  cityId: string;
  column: number;
  mapNodeId: string;
  name: string;
  row: number;
  tier: CityTier;
  timeZone: string;
}

interface SeedRouteLegDefinitionValue {
  distanceKm: number;
  driveMinutes: number;
  fromMapNodeId: string;
  id: string;
  toMapNodeId: string;
}

const SEED_ROUTE_LEG_DEFINITIONS: readonly SeedRouteLegDefinitionValue[] = [
  {
    distanceKm: 710,
    driveMinutes: 540,
    fromMapNodeId: SeedMapNodeId.MOSCOW,
    id: SeedRouteLegId.MOSCOW_SAINT_PETERSBURG,
    toMapNodeId: SeedMapNodeId.SAINT_PETERSBURG,
  },
  {
    distanceKm: 420,
    driveMinutes: 330,
    fromMapNodeId: SeedMapNodeId.MOSCOW,
    id: SeedRouteLegId.MOSCOW_NIZHNY_NOVGOROD,
    toMapNodeId: SeedMapNodeId.NIZHNY_NOVGOROD,
  },
  {
    distanceKm: 820,
    driveMinutes: 600,
    fromMapNodeId: SeedMapNodeId.MOSCOW,
    id: SeedRouteLegId.MOSCOW_KAZAN,
    toMapNodeId: SeedMapNodeId.KAZAN,
  },
  {
    distanceKm: 520,
    driveMinutes: 400,
    fromMapNodeId: SeedMapNodeId.MOSCOW,
    id: SeedRouteLegId.MOSCOW_VORONEZH,
    toMapNodeId: SeedMapNodeId.VORONEZH,
  },
  {
    distanceKm: 400,
    driveMinutes: 330,
    fromMapNodeId: SeedMapNodeId.NIZHNY_NOVGOROD,
    id: SeedRouteLegId.NIZHNY_NOVGOROD_KAZAN,
    toMapNodeId: SeedMapNodeId.KAZAN,
  },
  {
    distanceKm: 750,
    driveMinutes: 570,
    fromMapNodeId: SeedMapNodeId.VORONEZH,
    id: SeedRouteLegId.VORONEZH_KRASNODAR,
    toMapNodeId: SeedMapNodeId.KRASNODAR,
  },
  {
    distanceKm: 950,
    driveMinutes: 720,
    fromMapNodeId: SeedMapNodeId.KAZAN,
    id: SeedRouteLegId.KAZAN_YEKATERINBURG,
    toMapNodeId: SeedMapNodeId.YEKATERINBURG,
  },
  {
    distanceKm: 1000,
    driveMinutes: 780,
    fromMapNodeId: SeedMapNodeId.KAZAN,
    id: SeedRouteLegId.KAZAN_CHELYABINSK,
    toMapNodeId: SeedMapNodeId.CHELYABINSK,
  },
  {
    distanceKm: 210,
    driveMinutes: 170,
    fromMapNodeId: SeedMapNodeId.YEKATERINBURG,
    id: SeedRouteLegId.YEKATERINBURG_CHELYABINSK,
    toMapNodeId: SeedMapNodeId.CHELYABINSK,
  },
  {
    distanceKm: 1600,
    driveMinutes: 1260,
    fromMapNodeId: SeedMapNodeId.YEKATERINBURG,
    id: SeedRouteLegId.YEKATERINBURG_NOVOSIBIRSK,
    toMapNodeId: SeedMapNodeId.NOVOSIBIRSK,
  },
  {
    distanceKm: 1500,
    driveMinutes: 1200,
    fromMapNodeId: SeedMapNodeId.CHELYABINSK,
    id: SeedRouteLegId.CHELYABINSK_NOVOSIBIRSK,
    toMapNodeId: SeedMapNodeId.NOVOSIBIRSK,
  },
];

const SEED_CITY_DEFINITIONS: readonly SeedCityDefinitionValue[] = [
  {
    cityId: SeedCityId.MOSCOW,
    column: 4,
    mapNodeId: SeedMapNodeId.MOSCOW,
    name: 'Москва',
    row: 3,
    tier: CityTier.LARGE,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    cityId: SeedCityId.SAINT_PETERSBURG,
    column: 3,
    mapNodeId: SeedMapNodeId.SAINT_PETERSBURG,
    name: 'Санкт-Петербург',
    row: 0,
    tier: CityTier.LARGE,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    cityId: SeedCityId.KAZAN,
    column: 7,
    mapNodeId: SeedMapNodeId.KAZAN,
    name: 'Казань',
    row: 3,
    tier: CityTier.MEDIUM,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    cityId: SeedCityId.KRASNODAR,
    column: 2,
    mapNodeId: SeedMapNodeId.KRASNODAR,
    name: 'Краснодар',
    row: 7,
    tier: CityTier.MEDIUM,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    cityId: SeedCityId.VORONEZH,
    column: 3,
    mapNodeId: SeedMapNodeId.VORONEZH,
    name: 'Воронеж',
    row: 5,
    tier: CityTier.SMALL,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    cityId: SeedCityId.NIZHNY_NOVGOROD,
    column: 6,
    mapNodeId: SeedMapNodeId.NIZHNY_NOVGOROD,
    name: 'Нижний Новгород',
    row: 2,
    tier: CityTier.MEDIUM,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    cityId: SeedCityId.YEKATERINBURG,
    column: 10,
    mapNodeId: SeedMapNodeId.YEKATERINBURG,
    name: 'Екатеринбург',
    row: 3,
    tier: CityTier.MEDIUM,
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    cityId: SeedCityId.CHELYABINSK,
    column: 10,
    mapNodeId: SeedMapNodeId.CHELYABINSK,
    name: 'Челябинск',
    row: 5,
    tier: CityTier.SMALL,
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    cityId: SeedCityId.NOVOSIBIRSK,
    column: 14,
    mapNodeId: SeedMapNodeId.NOVOSIBIRSK,
    name: 'Новосибирск',
    row: 4,
    tier: CityTier.MEDIUM,
    timeZone: NOVOSIBIRSK_TIME_ZONE,
  },
];

export const createSeedCities = (): City[] => SEED_CITY_DEFINITIONS.map(definition => create(CitySchema, {
  id: definition.cityId,
  name: definition.name,
  tier: definition.tier,
  timeZone: definition.timeZone,
}));

export const createSeedMapNodes = (): MapNode[] => SEED_CITY_DEFINITIONS.map(definition => create(MapNodeSchema, {
  cityId: definition.cityId,
  id: definition.mapNodeId,
  position: { column: definition.column, row: definition.row },
}));

export const createSeedRouteLegs = (): RouteLeg[] => SEED_ROUTE_LEG_DEFINITIONS.map(definition => create(RouteLegSchema, definition));
