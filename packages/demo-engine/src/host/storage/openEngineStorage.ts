import type { IEngineStorage } from '../../core/ports/index';
import type {
  CreateIndexedDbStorageOptionsValue,
  IIndexedDbEngineStorage,
} from './indexedDbStorage';

import { createMemoryStorage } from '../../core/ports/index';
import { createIndexedDbStorage } from './indexedDbStorage';

export type OpenedEngineStorageValue
  = | { kind: 'indexed-db'; storage: IIndexedDbEngineStorage }
    | { kind: 'memory'; storage: IEngineStorage };

export const openEngineStorage = async (options: CreateIndexedDbStorageOptionsValue): Promise<OpenedEngineStorageValue> => {
  try {
    return { kind: 'indexed-db', storage: await createIndexedDbStorage(options) };
  }
  catch (error) {
    console.log('> openEngineStorage -> createIndexedDbStorage:', {
      databaseName: options.databaseName,
      error,
    });

    return { kind: 'memory', storage: createMemoryStorage() };
  }
};
