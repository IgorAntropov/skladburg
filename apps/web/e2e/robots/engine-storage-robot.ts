import type { Page } from '@playwright/test';

const DATABASE_NAME = 'skladburg-demo-engine';
const STORES_ADDED_AFTER_V13 = [
  'carrierLanes',
  'drivers',
  'transportOffers',
  'transportRequests',
  'trips',
  'vehicles',
  'warehouseTopologies',
] as const;
const PRE_FLEET_DATABASE_VERSION = 13;
const PRE_FLEET_SCHEMA_VERSION = 15;

interface MetadataChangeValue {
  isClockPaused: boolean;
  seedVersionOffset: number;
}

export const changeStoredEngineMetadata = async (page: Page, change: MetadataChangeValue): Promise<void> => {
  await page.evaluate(async ({ databaseName, isClockPaused, seedVersionOffset }): Promise<void> => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = (): void => {
        resolve(request.result);
      };
      request.onerror = (): void => {
        reject(request.error ?? new Error('IndexedDB request failed'));
      };
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('meta', 'readwrite');
        const store = transaction.objectStore('meta');
        const request = store.get('engineMeta');
        transaction.oncomplete = (): void => {
          resolve();
        };
        transaction.onabort = (): void => {
          reject(transaction.error ?? new Error('Metadata update aborted'));
        };
        transaction.onerror = (): void => {
          reject(transaction.error ?? new Error('Metadata update failed'));
        };
        request.onsuccess = (): void => {
          const meta: unknown = request.result;

          if (typeof meta !== 'object' || meta === null || !('seedVersion' in meta) || typeof meta.seedVersion !== 'number') {
            transaction.abort();

            return;
          }

          store.put({
            ...meta,
            ...(isClockPaused ? { timeScale: 0 } : {}),
            seedVersion: meta.seedVersion + seedVersionOffset,
          }, 'engineMeta');
        };
      });
    }
    finally {
      database.close();
    }
  }, { databaseName: DATABASE_NAME, ...change });
};

export const readStoredEngineSnapshot = async (page: Page, storeNames: readonly string[] = []): Promise<string> =>
  page.evaluate(async ({ databaseName, storeNames }): Promise<string> => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = (): void => {
        resolve(request.result);
      };
      request.onerror = (): void => {
        reject(request.error ?? new Error('IndexedDB request failed'));
      };
    });

    try {
      const names = storeNames.length === 0 ? Array.from(database.objectStoreNames) : [...storeNames];
      const transaction = database.transaction(names, 'readonly');
      const read = <TValue>(request: IDBRequest<TValue>): Promise<TValue> => new Promise((resolve, reject) => {
        request.onsuccess = (): void => {
          resolve(request.result);
        };
        request.onerror = (): void => {
          reject(request.error ?? new Error('IndexedDB request failed'));
        };
      });
      const snapshot = await Promise.all(names.map(async (name): Promise<unknown[]> => {
        const store = transaction.objectStore(name);
        const [keys, values] = await Promise.all([read(store.getAllKeys()), read(store.getAll())]);

        return [name, keys, values];
      }));

      return JSON.stringify(snapshot, (_key, value: unknown): unknown => typeof value === 'bigint' ? `${String(value)}n` : value);
    }
    finally {
      database.close();
    }
  }, { databaseName: DATABASE_NAME, storeNames });

export const recreatePreFleetEngineDatabase = async (page: Page): Promise<void> =>
  page.evaluate(async ({ databaseName, legacyDatabaseVersion, legacySchemaVersion, newStores }): Promise<void> => {
    const read = <TValue>(request: IDBRequest<TValue>): Promise<TValue> => new Promise((resolve, reject) => {
      request.onsuccess = (): void => {
        resolve(request.result);
      };
      request.onerror = (): void => {
        reject(request.error ?? new Error('IndexedDB request failed'));
      };
    });
    const current = await read(indexedDB.open(databaseName));
    const names = Array.from(current.objectStoreNames).filter(name => !newStores.some(store => store === name));
    const stores = await (async () => {
      try {
        const transaction = current.transaction(names, 'readonly');
        const completed = new Promise<void>((resolve, reject) => {
          transaction.oncomplete = (): void => {
            resolve();
          };
          transaction.onabort = (): void => {
            reject(transaction.error ?? new Error('IndexedDB snapshot read aborted'));
          };
        });
        const records = Promise.all(names.map(async (name) => {
          const store = transaction.objectStore(name);
          const [keys, values] = await Promise.all([read(store.getAllKeys()), read(store.getAll())]);
          return { keys, name, values };
        }));
        const [result] = await Promise.all([records, completed]);

        return result;
      }
      finally {
        current.close();
      }
    })();

    const deletion = indexedDB.deleteDatabase(databaseName);
    await new Promise<void>((resolve, reject) => {
      deletion.onsuccess = (): void => {
        resolve();
      };
      deletion.onblocked = (): void => {
        reject(new Error('The production Worker still holds the database open'));
      };
      deletion.onerror = (): void => {
        reject(deletion.error ?? new Error('IndexedDB deletion failed'));
      };
    });

    const request = indexedDB.open(databaseName, legacyDatabaseVersion);
    request.onupgradeneeded = (): void => {
      for (const { keys, name, values } of stores) {
        const store = request.result.createObjectStore(name);
        keys.forEach((key, index) => {
          const value: unknown = name === 'meta' && key === 'schemaVersion' ? legacySchemaVersion : values[index];
          store.put(value, key);
        });
      }
    };
    (await read(request)).close();
  }, {
    databaseName: DATABASE_NAME,
    legacyDatabaseVersion: PRE_FLEET_DATABASE_VERSION,
    legacySchemaVersion: PRE_FLEET_SCHEMA_VERSION,
    newStores: STORES_ADDED_AFTER_V13,
  });
