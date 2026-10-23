import type {
  WorldModelBoundsValue,
  WorldModelDataValue,
} from '../models/format/worldModelFormat';
import type { WorldModelWindowValue } from '../models/listWorldModelWindows';
import type { WorldModelPlacementValue } from '../models/placeWorldModels';
import type {
  WorldModelGroupValue,
  WorldModelWallWindowsValue,
} from '../models/worldModelCatalog';

import { listWorldModelWindows } from '../models/listWorldModelWindows';
import { WORLD_MODEL_CATALOG } from '../models/worldModelCatalog';

export type ModelWindowSourcesValue = ReadonlyMap<string, ModelWindowSourceValue>;

export interface ModelWindowSourceValue {
  bounds: WorldModelBoundsValue;
  glass: readonly WorldModelWindowValue[];
  group: WorldModelGroupValue;
  walls: undefined | WorldModelWallWindowsValue;
}

const wallsByModelId = new Map(WORLD_MODEL_CATALOG.map(entry => [entry.id, entry.walls]));

export const createModelWindowSources = (
  placements: readonly WorldModelPlacementValue[],
  models: ReadonlyMap<string, WorldModelDataValue>,
): ModelWindowSourcesValue => {
  const sources = new Map<string, ModelWindowSourceValue>();

  for (const { group, items, modelId } of placements) {
    const data = models.get(modelId);

    if (data !== undefined) {
      const source: ModelWindowSourceValue = {
        bounds: data.bounds,
        glass: listWorldModelWindows(data),
        group,
        walls: wallsByModelId.get(modelId),
      };

      for (const item of items) {
        sources.set(item.id, source);
      }
    }
  }

  return sources;
};
