import { create } from '@bufbuild/protobuf';
import {
  type City,
  CitySchema,
  type MapNode,
  MapNodeSchema,
} from '@skladburg/contracts/network/v1/network';

import {
  SeedCityId,
  SeedMapNodeId,
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
  timeZone: string;
}

const SEED_CITY_DEFINITIONS: readonly SeedCityDefinitionValue[] = [
  { cityId: SeedCityId.MOSCOW, column: 4, mapNodeId: SeedMapNodeId.MOSCOW, name: 'Москва', row: 3, timeZone: MOSCOW_TIME_ZONE },
  {
    cityId: SeedCityId.SAINT_PETERSBURG,
    column: 3,
    mapNodeId: SeedMapNodeId.SAINT_PETERSBURG,
    name: 'Санкт-Петербург',
    row: 0,
    timeZone: MOSCOW_TIME_ZONE,
  },
  { cityId: SeedCityId.KAZAN, column: 7, mapNodeId: SeedMapNodeId.KAZAN, name: 'Казань', row: 3, timeZone: MOSCOW_TIME_ZONE },
  {
    cityId: SeedCityId.KRASNODAR,
    column: 2,
    mapNodeId: SeedMapNodeId.KRASNODAR,
    name: 'Краснодар',
    row: 7,
    timeZone: MOSCOW_TIME_ZONE,
  },
  { cityId: SeedCityId.VORONEZH, column: 3, mapNodeId: SeedMapNodeId.VORONEZH, name: 'Воронеж', row: 5, timeZone: MOSCOW_TIME_ZONE },
  {
    cityId: SeedCityId.NIZHNY_NOVGOROD,
    column: 6,
    mapNodeId: SeedMapNodeId.NIZHNY_NOVGOROD,
    name: 'Нижний Новгород',
    row: 2,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    cityId: SeedCityId.YEKATERINBURG,
    column: 10,
    mapNodeId: SeedMapNodeId.YEKATERINBURG,
    name: 'Екатеринбург',
    row: 3,
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    cityId: SeedCityId.CHELYABINSK,
    column: 10,
    mapNodeId: SeedMapNodeId.CHELYABINSK,
    name: 'Челябинск',
    row: 5,
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    cityId: SeedCityId.NOVOSIBIRSK,
    column: 14,
    mapNodeId: SeedMapNodeId.NOVOSIBIRSK,
    name: 'Новосибирск',
    row: 4,
    timeZone: NOVOSIBIRSK_TIME_ZONE,
  },
];

export const createSeedCities = (): City[] => SEED_CITY_DEFINITIONS.map(definition => create(CitySchema, {
  id: definition.cityId,
  name: definition.name,
  timeZone: definition.timeZone,
}));

export const createSeedMapNodes = (): MapNode[] => SEED_CITY_DEFINITIONS.map(definition => create(MapNodeSchema, {
  cityId: definition.cityId,
  id: definition.mapNodeId,
  position: { column: definition.column, row: definition.row },
}));
