import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WorldModelPlacementValue } from '../models/placeWorldModels';

import { listWindowBuildings } from './listWindowBuildings';
import { createMixBuilding } from './mixTestSupport';

const createPlacement = (group: WorldModelPlacementValue['group'], ids: readonly string[]): WorldModelPlacementValue => ({
  group,
  items: ids.map(id => createMixBuilding(id)),
  matrices: new Float32Array(),
  modelId: `${group}/model`,
  tints: new Float32Array(),
});

describe('listWindowBuildings', () => {
  it('drops the houses and offices that are models and keeps the warehouses and the order', () => {
    const buildings = ['a', 'b', 'c', 'd', 'e'].map(id => createMixBuilding(id));
    const result = listWindowBuildings(buildings, [
      createPlacement('house', ['b']),
      createPlacement('office', ['d']),
      createPlacement('warehouse', ['c']),
    ]);

    expect(result.map(building => building.id)).toEqual(['a', 'c', 'e']);
  });
});
