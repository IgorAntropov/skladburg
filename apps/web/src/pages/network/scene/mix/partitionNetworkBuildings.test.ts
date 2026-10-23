import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkCityTierValue } from '@/entities/network';
import type { QualityLevelValue } from '@/shared/3d';

import type { NetworkSceneBuildingValue } from '../layout';
import type { BuildingPartitionValue } from './partitionNetworkBuildings';

import { COMPANY_WAREHOUSE_MODEL_ID } from '../models/worldModelCatalog';
import { listWorldModelsForLevel } from '../models/worldModelLods';
import {
  createCatalogModels,
  createMixBuilding,
} from './mixTestSupport';
import { partitionNetworkBuildings } from './partitionNetworkBuildings';

const LEVELS: readonly QualityLevelValue[] = ['low', 'medium', 'high'];
const TIER_BY_CITY_ID: ReadonlyMap<string, NetworkCityTierValue> = new Map([
  ['big', 'large'],
  ['mid', 'medium'],
  ['tiny', 'small'],
]);
const CITY_IDS = ['big', 'mid', 'tiny'];

const createBuildings = (): NetworkSceneBuildingValue[] => {
  const buildings: NetworkSceneBuildingValue[] = [];

  for (const cityId of CITY_IDS) {
    buildings.push(createMixBuilding(`site:${cityId}`, { cityId, isCompany: true, kind: 'warehouse' }));

    for (let index = 0; index < 120; index += 1) {
      buildings.push(createMixBuilding(`decor:${cityId}:${String(index)}`, {
        cityId,
        depth: 1 + (index % 4) * 0.1,
        kind: index % 3 === 0 ? 'office' : 'house',
        rank: index / 120,
        width: 1.1 + (index % 5) * 0.1,
      }));
    }
  }

  return buildings;
};

const BUILDINGS = createBuildings();

const partition = (
  buildings: readonly NetworkSceneBuildingValue[],
  level: QualityLevelValue = 'high',
  models = createCatalogModels(),
): BuildingPartitionValue => partitionNetworkBuildings(buildings, { level, models, tierByCityId: TIER_BY_CITY_ID });

const listIds = (buildings: readonly NetworkSceneBuildingValue[]): string[] => buildings.map(building => building.id);

const listPlacedIds = ({ placements }: BuildingPartitionValue): string[] => placements.flatMap(placement => listIds(placement.items));

const mapModelByBuildingId = ({ placements }: BuildingPartitionValue): Map<string, string> => new Map(
  placements.flatMap(placement => placement.items.map((item): [string, string] => [item.id, placement.modelId])),
);

describe('partitionNetworkBuildings', () => {
  it('puts every building into exactly one list', () => {
    for (const level of LEVELS) {
      const result = partition(BUILDINGS, level);
      const ids = [...listIds(result.beveled), ...listIds(result.boxes), ...listPlacedIds(result)];

      expect(ids).toHaveLength(BUILDINGS.length);
      expect(new Set(ids)).toEqual(new Set(listIds(BUILDINGS)));
    }
  });

  it('uses all three kinds of buildings', () => {
    const result = partition(BUILDINGS);

    expect(result.beveled.length).toBeGreaterThan(0);
    expect(result.boxes.length).toBeGreaterThan(0);
    expect(listPlacedIds(result).length).toBeGreaterThan(0);
  });

  it('keeps the order of the input in every list', () => {
    const positionById = new Map(BUILDINGS.map((building, index) => [building.id, index]));
    const isAscending = (ids: readonly string[]): boolean => ids.every((id, index) => (
      index === 0 || (positionById.get(id) ?? 0) > (positionById.get(ids[index - 1] ?? '') ?? 0)
    ));
    const withoutModels = partition(BUILDINGS, 'high', new Map());

    for (const level of LEVELS) {
      const result = partition(BUILDINGS, level);

      expect(isAscending(listIds(result.beveled))).toBe(true);
      expect(isAscending(listIds(result.boxes))).toBe(true);

      for (const placement of result.placements) {
        expect(isAscending(listIds(placement.items))).toBe(true);
      }
    }

    expect(isAscending(listIds(withoutModels.boxes))).toBe(true);
  });

  it('keeps the kind of every building when the order of the input is shuffled and on every level', () => {
    const shuffled = [...BUILDINGS.slice(137), ...BUILDINGS.slice(0, 137)].toReversed();
    const styleOf = (result: BuildingPartitionValue): Map<string, string> => new Map([
      ...result.beveled.map((building): [string, string] => [building.id, 'beveled']),
      ...result.boxes.map((building): [string, string] => [building.id, 'box']),
      ...listPlacedIds(result).map((id): [string, string] => [id, 'model']),
    ]);

    for (const level of LEVELS) {
      expect(styleOf(partition(shuffled, level))).toEqual(styleOf(partition(BUILDINGS, 'high')));
    }
  });

  it('gives the warehouse model to every company on every level', () => {
    for (const level of LEVELS) {
      const result = partition(BUILDINGS, level);
      const modelById = mapModelByBuildingId(result);

      for (const building of BUILDINGS.filter(candidate => candidate.isCompany)) {
        expect(modelById.get(building.id)).toBe(COMPANY_WAREHOUSE_MODEL_ID);
      }
    }
  });

  it('leaves a building whose model is not loaded as a box and does not move the others', () => {
    const all = partition(BUILDINGS);
    const missingId = [...all.placements].find(placement => placement.modelId !== COMPANY_WAREHOUSE_MODEL_ID)?.modelId ?? '';
    const models = createCatalogModels();

    models.delete(missingId);

    const partial = partition(BUILDINGS, 'high', models);
    const allModels = mapModelByBuildingId(all);
    const partialModels = mapModelByBuildingId(partial);
    const lostIds = listIds(BUILDINGS).filter(id => allModels.get(id) === missingId);

    expect(missingId).not.toBe('');
    expect(lostIds.length).toBeGreaterThan(0);
    expect(listIds(partial.beveled)).toEqual(listIds(all.beveled));

    for (const id of lostIds) {
      expect(partialModels.has(id)).toBe(false);
      expect(listIds(partial.boxes)).toContain(id);
    }

    for (const [id, modelId] of partialModels) {
      expect(modelId).toBe(allModels.get(id));
    }
  });

  it('turns every model into a box while nothing is loaded, companies included', () => {
    const result = partition(BUILDINGS, 'high', new Map());

    expect(result.placements).toEqual([]);
    expect(listIds(result.boxes).length + result.beveled.length).toBe(BUILDINGS.length);
    expect(listIds(result.boxes)).toContain('site:big');
  });

  it('takes only the light models for houses on the low level', () => {
    const lightIds = new Set(listWorldModelsForLevel('house', 'low').map(entry => entry.id));
    const houseModelIds = partition(BUILDINGS, 'low').placements
      .filter(placement => placement.group === 'house')
      .map(placement => placement.modelId);

    expect(houseModelIds.length).toBeGreaterThan(0);
    expect(houseModelIds.every(id => lightIds.has(id))).toBe(true);
  });

  it('takes the full models for houses on the other levels', () => {
    for (const level of ['medium', 'high'] as const) {
      const fullIds = new Set(listWorldModelsForLevel('house', level).map(entry => entry.id));
      const houseModelIds = partition(BUILDINGS, level).placements
        .filter(placement => placement.group === 'house')
        .map(placement => placement.modelId);

      expect(houseModelIds.every(id => fullIds.has(id))).toBe(true);
    }
  });

  it('treats a city without a tier as a medium one', () => {
    const building = createMixBuilding('decor:ghost:1', { cityId: 'ghost' });
    const asMedium = partitionNetworkBuildings([building], {
      level: 'high',
      models: createCatalogModels(),
      tierByCityId: new Map([['ghost', 'medium']]),
    });

    expect(partition([building])).toEqual(asMedium);
  });
});
