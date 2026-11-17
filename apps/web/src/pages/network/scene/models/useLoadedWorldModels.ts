import { useMemo } from 'react';

import type { WorldModelDataValue } from './format/worldModelFormat';

import { loadWorldModels } from './loadWorldModels';
import {
  INDUSTRIAL_YARD_MODEL,
  NETWORK_SCENERY_MODELS,
  WORLD_MODEL_CATALOG,
} from './worldModelCatalog';

const ID_SEPARATOR = '|';

const WORLD_MODEL_FILES = [...WORLD_MODEL_CATALOG, INDUSTRIAL_YARD_MODEL, ...NETWORK_SCENERY_MODELS];

const readLoadedModels = (loadedKey: string): ReadonlyMap<string, WorldModelDataValue> => new Map(
  loadedKey === ''
    ? []
    : loadedKey.split(ID_SEPARATOR).flatMap((id): [string, WorldModelDataValue][] => {
        const model = loadWorldModels.peek(id);

        return model === undefined ? [] : [[id, model]];
      }),
);

export const useLoadedWorldModels = (): ReadonlyMap<string, WorldModelDataValue> => {
  const loadedKey = WORLD_MODEL_FILES
    .filter(({ id }) => loadWorldModels.peek(id) !== undefined)
    .map(({ id }) => id)
    .join(ID_SEPARATOR);

  return useMemo(() => readLoadedModels(loadedKey), [loadedKey]);
};
