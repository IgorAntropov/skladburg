import type { WorldModelDataValue } from './format/worldModelFormat';
import type { WorldModelEntryValue } from './worldModelCatalog';

import { readWorldModel } from './format/worldModelFormat';
import {
  buildWorldModelPath,
  WORLD_MODEL_CATALOG,
} from './worldModelCatalog';

export type FetchWorldModelBuffer = (url: string) => Promise<ArrayBuffer>;

export interface IWorldModelLoader {
  (ids: readonly string[]): Promise<ReadonlyMap<string, WorldModelDataValue>>;
  peek: (id: string) => undefined | WorldModelDataValue;
}

const BYTES_IN_KILOBYTE = 1024;
const KILOBYTE_DECIMALS = 100;

const roundKiloBytes = (bytes: number): number => Math.round((bytes / BYTES_IN_KILOBYTE) * KILOBYTE_DECIMALS) / KILOBYTE_DECIMALS;

export const createWorldModelLoader = (fetchBuffer: FetchWorldModelBuffer): IWorldModelLoader => {
  const entriesById = new Map<string, WorldModelEntryValue>(WORLD_MODEL_CATALOG.map(entry => [entry.id, entry]));
  const modelCache = new Map<string, Promise<WorldModelDataValue>>();
  const loadedModels = new Map<string, WorldModelDataValue>();

  const fetchModel = async (entry: WorldModelEntryValue): Promise<WorldModelDataValue> => {
    const buffer = await fetchBuffer(`${import.meta.env.BASE_URL}${buildWorldModelPath(entry)}`);
    const model = readWorldModel(buffer);

    console.log('> WorldModels -> load:', {
      id: entry.id,
      kiloBytes: roundKiloBytes(buffer.byteLength),
      triangleCount: model.triangleCount,
      vertexCount: model.vertexCount,
    });

    return model;
  };

  const loadOne = (id: string): Promise<WorldModelDataValue> => {
    const cached = modelCache.get(id);

    if (cached !== undefined) {
      return cached;
    }

    const entry = entriesById.get(id);

    if (entry === undefined) {
      return Promise.reject(new Error(`World model: unknown id ${id}`));
    }

    const loading = fetchModel(entry);

    modelCache.set(id, loading);
    loading.then(
      (model) => {
        loadedModels.set(id, model);
      },
      () => {
        modelCache.delete(id);
      },
    );

    return loading;
  };

  const loadPair = async (id: string): Promise<[string, WorldModelDataValue]> => [id, await loadOne(id)];

  const load = async (ids: readonly string[]): Promise<ReadonlyMap<string, WorldModelDataValue>> => new Map(
    await Promise.all(ids.map(loadPair)),
  );

  const peek = (id: string): undefined | WorldModelDataValue => loadedModels.get(id);

  return Object.assign(load, { peek });
};
