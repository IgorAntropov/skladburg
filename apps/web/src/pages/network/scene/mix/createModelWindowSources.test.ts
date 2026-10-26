import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WorldModelPlacementValue } from '../models/placeWorldModels';

import { WORLD_MODEL_ROLES } from '../models/format/worldModelFormat';
import { listWorldModelWindows } from '../models/listWorldModelWindows';
import { WORLD_MODEL_CATALOG } from '../models/worldModelCatalog';
import { createTrianglesWorldModel } from '../models/worldModelTestSupport';
import { createModelWindowSources } from './createModelWindowSources';
import { createMixBuilding } from './mixTestSupport';

const GLASS = WORLD_MODEL_ROLES.indexOf('glass');

const createPlacement = (
  modelId: string,
  group: WorldModelPlacementValue['group'],
  ids: readonly string[],
): WorldModelPlacementValue => ({
  group,
  items: ids.map(id => createMixBuilding(id)),
  matrices: new Float32Array(),
  modelId,
  tints: new Float32Array(),
});

const GLASS_MODEL = createTrianglesWorldModel([
  { corners: [[0, 0, 0.4], [0.2, 0, 0.4], [0.2, 0.3, 0.4]], role: GLASS },
  { corners: [[0, 0, 0.4], [0.2, 0.3, 0.4], [0, 0.3, 0.4]], role: GLASS },
]);

describe('createModelWindowSources', () => {
  it('gives every building of a placement the glass of its model and the walls and far walls of its catalog entry', () => {
    const sources = createModelWindowSources(
      [
        createPlacement('commercial/building-a', 'house', ['a', 'b']),
        createPlacement('commercial/low-detail-building-n', 'house', ['c']),
      ],
      new Map([['commercial/building-a', GLASS_MODEL], ['commercial/low-detail-building-n', GLASS_MODEL]]),
    );

    expect([...sources.keys()]).toEqual(['a', 'b', 'c']);
    expect(sources.get('a')).toBe(sources.get('b'));
    expect(sources.get('a')?.glass).toEqual(listWorldModelWindows(GLASS_MODEL));
    expect(sources.get('a')?.glass).toHaveLength(1);
    expect(sources.get('a')?.walls).toBeUndefined();
    expect(sources.get('a')?.bounds).toBe(GLASS_MODEL.bounds);
    expect(sources.get('a')?.farWalls).toBe(WORLD_MODEL_CATALOG.find(({ id }) => id === 'commercial/building-a')?.farWalls);
    expect(sources.get('c')?.walls?.faces).toHaveLength(4);
    expect(sources.get('c')?.farWalls).toBe(sources.get('c')?.walls);
    expect(sources.get('c')?.group).toBe('house');
  });
});
