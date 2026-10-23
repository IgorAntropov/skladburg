import {
  Matrix4,
  Vector3,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkSceneBuildingValue } from '../layout';
import type { WorldModelEntryValue } from './worldModelCatalog';

import { PLAZA_HEIGHT_METERS } from '../geometry/networkSceneMetrics';
import { fitWorldModelToFootprint } from './fitWorldModelToFootprint';
import { placeWorldModels } from './placeWorldModels';
import { WORLD_MODEL_CATALOG } from './worldModelCatalog';
import { createTestWorldModel } from './worldModelTestSupport';

const findEntry = (id: string): WorldModelEntryValue => {
  const entry = WORLD_MODEL_CATALOG.find(candidate => candidate.id === id);

  if (entry === undefined) {
    throw new Error(`Unknown catalog id ${id}`);
  }

  return entry;
};

const WAREHOUSE_ENTRY = findEntry('industrial/building-k');
const HOUSE_ENTRY = findEntry('commercial/building-a');
const SECOND_HOUSE_ENTRY = findEntry('commercial/building-b');

const WAREHOUSE_MODEL = createTestWorldModel({ bounds: { max: [0.65, 0.9, 0.39], min: [-0.65, 0, -0.39] } });

const MODELS = new Map([
  [HOUSE_ENTRY.id, createTestWorldModel()],
  [SECOND_HOUSE_ENTRY.id, createTestWorldModel()],
  [WAREHOUSE_ENTRY.id, WAREHOUSE_MODEL],
]);

const createBuilding = (id: string, overrides: Partial<NetworkSceneBuildingValue> = {}): NetworkSceneBuildingValue => ({
  cityId: 'city',
  depth: 1.5,
  height: 1.5,
  id,
  isCompany: true,
  isOwn: false,
  kind: 'warehouse',
  rank: 0,
  rotation: 0.4,
  side: 'supplier',
  siteId: id,
  width: 2.4,
  x: 5,
  z: -3,
  ...overrides,
});

const pickByKind = (building: NetworkSceneBuildingValue): undefined | WorldModelEntryValue => {
  if (building.kind === 'warehouse') {
    return WAREHOUSE_ENTRY;
  }

  return building.id.endsWith('b') ? SECOND_HOUSE_ENTRY : HOUSE_ENTRY;
};

const readMatrix = (matrices: Float32Array, index: number): number[] => [...matrices.slice(index * 16, index * 16 + 16)];

describe('placeWorldModels', () => {
  const buildings = [
    createBuilding('w1', { x: 1 }),
    createBuilding('h1', { isCompany: false, kind: 'house', rank: 0.2, x: 2 }),
    createBuilding('w2', { x: 3, z: 4 }),
    createBuilding('h2b', { isCompany: false, kind: 'house', rank: 0.4, x: 4 }),
    createBuilding('o1', { isCompany: false, kind: 'office', rank: 0.6, x: 6 }),
  ];

  it('groups buildings by the model that was picked for them in the order of the input', () => {
    const { placements } = placeWorldModels(buildings, pickByKind, MODELS);

    expect(placements.map(placement => [placement.modelId, placement.group, placement.items.map(item => item.id)])).toEqual([
      [HOUSE_ENTRY.id, 'house', ['h1', 'o1']],
      [SECOND_HOUSE_ENTRY.id, 'house', ['h2b']],
      [WAREHOUSE_ENTRY.id, 'warehouse', ['w1', 'w2']],
    ]);
  });

  it('hands buildings without a model and with a model that is not loaded to the rest in the order of the input', () => {
    const onlyWarehouse = placeWorldModels(buildings, pickByKind, new Map([[WAREHOUSE_ENTRY.id, WAREHOUSE_MODEL]]));
    const nothingPicked = placeWorldModels(buildings, () => undefined, MODELS);

    expect(onlyWarehouse.placements.map(placement => placement.modelId)).toEqual([WAREHOUSE_ENTRY.id]);
    expect(onlyWarehouse.rest.map(building => building.id)).toEqual(['h1', 'h2b', 'o1']);
    expect(nothingPicked.placements).toEqual([]);
    expect(nothingPicked.rest).toEqual(buildings);
  });

  it('loses no building and repeats none between the placements and the rest', () => {
    const { placements, rest } = placeWorldModels(buildings, pickByKind, new Map([
      [HOUSE_ENTRY.id, createTestWorldModel()],
      [WAREHOUSE_ENTRY.id, WAREHOUSE_MODEL],
    ]));
    const ids = [...placements.flatMap(placement => placement.items), ...rest].map(building => building.id);

    expect(ids.toSorted()).toEqual(buildings.map(building => building.id).toSorted());
    expect(new Set(ids).size).toBe(buildings.length);
    expect(rest.map(building => building.id)).toEqual(['h2b']);
  });

  it('puts the model at the center of the building on the plaza with the fit of its footprint', () => {
    const [placement] = placeWorldModels([createBuilding('w1', { x: 7, z: -2 })], pickByKind, MODELS).placements;
    const fit = fitWorldModelToFootprint(WAREHOUSE_MODEL.bounds, createBuilding('w1'));
    const matrix = new Matrix4().fromArray(placement?.matrices ?? []);
    const elements = matrix.elements;

    expect(elements[12]).toBeCloseTo(7, 5);
    expect(elements[13]).toBeCloseTo(PLAZA_HEIGHT_METERS, 5);
    expect(elements[14]).toBeCloseTo(-2, 5);
    expect(new Vector3().setFromMatrixColumn(matrix, 0).length()).toBeCloseTo(fit.scale[0], 5);
    expect(new Vector3().setFromMatrixColumn(matrix, 2).length()).toBeCloseTo(fit.scale[2], 5);
  });

  it('turns the building by a quarter when its footprint is the other way round', () => {
    const [straight] = placeWorldModels([createBuilding('w1', { rotation: 0 })], pickByKind, MODELS).placements;
    const [turned] = placeWorldModels([createBuilding('w1', { depth: 2.4, rotation: 0, width: 1.5 })], pickByKind, MODELS).placements;

    expect(straight?.matrices[2]).toBeCloseTo(0, 5);
    expect(Math.abs(turned?.matrices[2] ?? 0)).toBeGreaterThan(1);
  });

  it('is deterministic and does not depend on the order of the buildings', () => {
    const first = placeWorldModels(buildings, pickByKind, MODELS).placements;
    const again = placeWorldModels(buildings, pickByKind, MODELS).placements;
    const reversed = placeWorldModels(buildings.toReversed(), pickByKind, MODELS).placements;

    expect(again).toEqual(first);

    for (const placement of first) {
      const counterpart = reversed.find(candidate => candidate.modelId === placement.modelId);

      for (const [index, item] of placement.items.entries()) {
        const reversedIndex = counterpart?.items.findIndex(candidate => candidate.id === item.id) ?? -1;

        expect(reversedIndex).toBeGreaterThanOrEqual(0);
        expect(readMatrix(counterpart?.matrices ?? new Float32Array(), reversedIndex)).toEqual(readMatrix(placement.matrices, index));
        expect(counterpart?.tints.slice(reversedIndex * 3, reversedIndex * 3 + 3)).toEqual(placement.tints.slice(index * 3, index * 3 + 3));
      }
    }
  });

  it('keeps the warehouses untinted and tints houses and offices by their id', () => {
    const { placements } = placeWorldModels(buildings, pickByKind, MODELS);
    const warehouse = placements.find(placement => placement.group === 'warehouse');
    const houses = placements.filter(placement => placement.group === 'house');

    expect([...(warehouse?.tints ?? [])]).toEqual([1, 1, 1, 1, 1, 1]);

    for (const placement of houses) {
      for (let index = 0; index < placement.items.length; index += 1) {
        const tint = [...placement.tints.slice(index * 3, index * 3 + 3)];

        expect(tint[0]).toBeGreaterThanOrEqual(0.94);
        expect(tint[0]).toBeLessThanOrEqual(1);
        expect(tint).toEqual([tint[0], tint[0], tint[0]]);
      }
    }
  });

  it('writes one matrix and one tint triple per building', () => {
    const [placement] = placeWorldModels(buildings, pickByKind, MODELS).placements;

    expect(placement?.matrices).toHaveLength((placement?.items.length ?? 0) * 16);
    expect(placement?.tints).toHaveLength((placement?.items.length ?? 0) * 3);
  });
});
