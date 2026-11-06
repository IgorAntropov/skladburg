import type { Page } from '@playwright/test';

const DATABASE_NAME = 'skladburg-demo-engine';

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

export const readStoredEngineSnapshot = async (page: Page): Promise<string> =>
  page.evaluate(async (databaseName): Promise<string> => {
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
      const names = Array.from(database.objectStoreNames);
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
  }, DATABASE_NAME);
