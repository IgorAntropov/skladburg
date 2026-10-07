import { create } from '@bufbuild/protobuf';
import {
  type BoardNode,
  BoardNodeSchema,
  type City,
  CitySchema,
} from '@skladburg/contracts/network/v1/network';

import {
  SeedBoardNodeId,
  SeedCityId,
} from './seedIds';

export const MOSCOW_TIME_ZONE = 'Europe/Moscow';
export const YEKATERINBURG_TIME_ZONE = 'Asia/Yekaterinburg';
export const NOVOSIBIRSK_TIME_ZONE = 'Asia/Novosibirsk';

interface SeedCityDefinitionValue {
  boardNodeId: string;
  cityId: string;
  column: number;
  name: string;
  row: number;
  timeZone: string;
}

const SEED_CITY_DEFINITIONS: readonly SeedCityDefinitionValue[] = [
  { boardNodeId: SeedBoardNodeId.MOSCOW, cityId: SeedCityId.MOSCOW, column: 4, name: 'Москва', row: 3, timeZone: MOSCOW_TIME_ZONE },
  {
    boardNodeId: SeedBoardNodeId.SAINT_PETERSBURG,
    cityId: SeedCityId.SAINT_PETERSBURG,
    column: 3,
    name: 'Санкт-Петербург',
    row: 0,
    timeZone: MOSCOW_TIME_ZONE,
  },
  { boardNodeId: SeedBoardNodeId.KAZAN, cityId: SeedCityId.KAZAN, column: 7, name: 'Казань', row: 3, timeZone: MOSCOW_TIME_ZONE },
  {
    boardNodeId: SeedBoardNodeId.KRASNODAR,
    cityId: SeedCityId.KRASNODAR,
    column: 2,
    name: 'Краснодар',
    row: 7,
    timeZone: MOSCOW_TIME_ZONE,
  },
  { boardNodeId: SeedBoardNodeId.VORONEZH, cityId: SeedCityId.VORONEZH, column: 3, name: 'Воронеж', row: 5, timeZone: MOSCOW_TIME_ZONE },
  {
    boardNodeId: SeedBoardNodeId.NIZHNY_NOVGOROD,
    cityId: SeedCityId.NIZHNY_NOVGOROD,
    column: 6,
    name: 'Нижний Новгород',
    row: 2,
    timeZone: MOSCOW_TIME_ZONE,
  },
  {
    boardNodeId: SeedBoardNodeId.YEKATERINBURG,
    cityId: SeedCityId.YEKATERINBURG,
    column: 10,
    name: 'Екатеринбург',
    row: 3,
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    boardNodeId: SeedBoardNodeId.CHELYABINSK,
    cityId: SeedCityId.CHELYABINSK,
    column: 10,
    name: 'Челябинск',
    row: 5,
    timeZone: YEKATERINBURG_TIME_ZONE,
  },
  {
    boardNodeId: SeedBoardNodeId.NOVOSIBIRSK,
    cityId: SeedCityId.NOVOSIBIRSK,
    column: 14,
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

export const createSeedBoardNodes = (): BoardNode[] => SEED_CITY_DEFINITIONS.map(definition => create(BoardNodeSchema, {
  cityId: definition.cityId,
  id: definition.boardNodeId,
  position: { column: definition.column, row: definition.row },
}));
