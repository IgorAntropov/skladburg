import type { NetworkSceneBuildingValue } from '../layout';
import type { WorldModelDataValue } from './format/worldModelFormat';
import type {
  WorldModelEntryValue,
  WorldModelGroupValue,
} from './worldModelCatalog';

import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from '../geometry/composeInstanceMatrix';
import {
  PLAZA_HEIGHT_METERS,
  WALL_TINT_RANGE,
} from '../geometry/networkSceneMetrics';
import {
  hashUnit,
  LAYOUT_SALT,
  lerpRange,
} from '../layout';
import { NETWORK_WORLD_SEED } from '../networkWorldConstants';
import { fitWorldModelToFootprint } from './fitWorldModelToFootprint';

export interface WorldModelPlacementValue {
  group: WorldModelGroupValue;
  items: readonly NetworkSceneBuildingValue[];
  matrices: Float32Array;
  modelId: string;
  tints: Float32Array;
}

interface PlacementDraftValue {
  entry: WorldModelEntryValue;
  items: NetworkSceneBuildingValue[];
  model: WorldModelDataValue;
}

const TINT_ITEM_SIZE = 3;
const NEUTRAL_TINT = 1;
const TINTED_GROUPS: readonly WorldModelGroupValue[] = ['house', 'office'];

const resolveTint = (group: WorldModelGroupValue, building: NetworkSceneBuildingValue): number => (
  TINTED_GROUPS.includes(group)
    ? lerpRange(WALL_TINT_RANGE, hashUnit(NETWORK_WORLD_SEED, building.id, LAYOUT_SALT.wallTint))
    : NEUTRAL_TINT
);

export const placeWorldModels = (
  buildings: readonly NetworkSceneBuildingValue[],
  pickModel: (building: NetworkSceneBuildingValue) => undefined | WorldModelEntryValue,
  models: ReadonlyMap<string, WorldModelDataValue>,
): readonly WorldModelPlacementValue[] => {
  const draftsByModel = new Map<string, PlacementDraftValue>();

  for (const building of buildings) {
    const entry = pickModel(building);
    const model = entry === undefined ? undefined : models.get(entry.id);

    if (entry !== undefined && model !== undefined) {
      const draft = draftsByModel.get(entry.id) ?? { entry, items: [], model };

      draft.items.push(building);
      draftsByModel.set(entry.id, draft);
    }
  }

  return [...draftsByModel.entries()]
    .toSorted(([currentId], [prevId]) => currentId.localeCompare(prevId))
    .map(([modelId, { entry, items, model }]): WorldModelPlacementValue => {
      const matrices = new Float32Array(items.length * INSTANCE_MATRIX_ITEM_SIZE);
      const tints = new Float32Array(items.length * TINT_ITEM_SIZE);

      for (const [index, building] of items.entries()) {
        const fit = fitWorldModelToFootprint(model.bounds, building);

        writeInstanceMatrix(matrices, index, {
          rotationY: fit.rotationY,
          scale: fit.scale,
          x: building.x,
          y: PLAZA_HEIGHT_METERS,
          z: building.z,
        });
        tints.fill(resolveTint(entry.group, building), index * TINT_ITEM_SIZE, (index + 1) * TINT_ITEM_SIZE);
      }

      return { group: entry.group, items, matrices, modelId, tints };
    });
};
