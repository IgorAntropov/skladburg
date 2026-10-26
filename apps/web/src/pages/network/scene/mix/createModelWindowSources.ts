import type {
  WorldModelBoundsValue,
  WorldModelDataValue,
} from '../models/format/worldModelFormat';
import type { WorldModelWindowValue } from '../models/listWorldModelWindows';
import type { WorldModelPlacementValue } from '../models/placeWorldModels';
import type {
  WorldModelEntryValue,
  WorldModelGroupValue,
  WorldModelWallWindowsValue,
} from '../models/worldModelCatalog';

import { listWorldModelWindows } from '../models/listWorldModelWindows';
import { WORLD_MODEL_CATALOG } from '../models/worldModelCatalog';

export type ModelWindowSourcesValue = ReadonlyMap<string, ModelWindowSourceValue>;

export interface ModelWindowSourceValue {
  bounds: WorldModelBoundsValue;
  farWalls: WorldModelWallWindowsValue;
  glass: readonly WorldModelWindowValue[];
  group: WorldModelGroupValue;
  walls: undefined | WorldModelWallWindowsValue;
}

const entryByModelId: ReadonlyMap<string, WorldModelEntryValue> = new Map(WORLD_MODEL_CATALOG.map(entry => [entry.id, entry]));

export const createModelWindowSources = (
  placements: readonly WorldModelPlacementValue[],
  models: ReadonlyMap<string, WorldModelDataValue>,
): ModelWindowSourcesValue => {
  const sources = new Map<string, ModelWindowSourceValue>();

  for (const { group, items, modelId } of placements) {
    const data = models.get(modelId);
    const entry = entryByModelId.get(modelId);

    if (data !== undefined && entry !== undefined) {
      const source: ModelWindowSourceValue = {
        bounds: data.bounds,
        farWalls: entry.farWalls,
        glass: listWorldModelWindows(data),
        group,
        walls: entry.walls,
      };

      for (const item of items) {
        sources.set(item.id, source);
      }
    }
  }

  return sources;
};
