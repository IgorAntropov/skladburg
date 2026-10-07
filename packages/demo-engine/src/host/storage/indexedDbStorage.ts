import type {
  IDBPDatabase,
  IDBPTransaction,
} from 'idb';

import { wrap } from 'idb';

import type {
  EngineChangeSetValue,
  EngineCollectionName,
  EngineCollectionValue,
  EngineMetaValue,
  EngineSnapshotValue,
  IEngineStorage,
  StoredRecordValue,
} from '../../core/ports/index';

import {
  createEmptyCollections,
  ENGINE_COLLECTION_NAMES,
} from '../../core/ports/index';

export const INDEXED_DB_VERSION = 1;

const META_STORE_NAME = 'meta';
const SCHEMA_VERSION_KEY = 'schemaVersion';
const ENGINE_META_KEY = 'engineMeta';

const ALL_STORE_NAMES: readonly string[] = [...ENGINE_COLLECTION_NAMES, META_STORE_NAME];

export interface CreateIndexedDbStorageOptionsValue {
  databaseName: string;
  factory?: IDBFactory | undefined;
  version?: number | undefined;
}

export interface IIndexedDbEngineStorage extends IEngineStorage {
  clear: () => Promise<void>;
  close: () => void;
}

type CollectionEntryValue = readonly [EngineCollectionName, EngineCollectionValue];

type EngineDatabaseValue = IDBPDatabase;

type EngineTransactionValue<TMode extends IDBTransactionMode> = IDBPTransaction<unknown, string[], TMode>;

interface TransactionHandleValue {
  abort: () => void;
  done: Promise<void>;
}

const isStoredRecord = (value: unknown): value is StoredRecordValue => typeof value === 'object' && value !== null;

const isEngineMeta = (value: unknown): value is EngineMetaValue => typeof value === 'object' && value !== null;

const readStoreKey = (key: unknown): string => {
  if (typeof key !== 'string') {
    throw new Error('The engine database holds a record with a non-string key');
  }

  return key;
};

const recreateStores = (database: IDBDatabase): void => {
  for (const name of Array.from(database.objectStoreNames)) {
    database.deleteObjectStore(name);
  }

  for (const name of ALL_STORE_NAMES) {
    database.createObjectStore(name);
  }
};

const openDatabase = (
  factory: IDBFactory,
  databaseName: string,
  version: number,
): Promise<EngineDatabaseValue> => new Promise((resolve, reject) => {
  const request = factory.open(databaseName, version);
  let isSettled = false;

  const handleUpgradeNeeded = (): void => {
    if (isSettled) {
      request.transaction?.abort();

      return;
    }

    recreateStores(request.result);
  };

  const handleBlocked = (): void => {
    if (isSettled) {
      return;
    }

    isSettled = true;
    console.log('> IndexedDbStorage -> blocked:', { databaseName, version });
    reject(new Error('The engine database is blocked by another connection'));
  };

  const handleVersionChange = (event: IDBVersionChangeEvent): void => {
    console.log('> IndexedDbStorage -> versionchange:', {
      databaseName,
      newVersion: event.newVersion,
      oldVersion: event.oldVersion,
    });
    request.result.close();
  };

  const handleSuccess = (): void => {
    if (isSettled) {
      request.result.close();

      return;
    }

    isSettled = true;
    request.result.addEventListener('versionchange', handleVersionChange);
    resolve(wrap(request.result));
  };

  const handleError = (): void => {
    if (isSettled) {
      return;
    }

    isSettled = true;
    reject(request.error ?? new Error('The engine database did not open'));
  };

  request.addEventListener('upgradeneeded', handleUpgradeNeeded);
  request.addEventListener('blocked', handleBlocked);
  request.addEventListener('success', handleSuccess);
  request.addEventListener('error', handleError);
});

const resolveFactory = (factory: IDBFactory | undefined): IDBFactory => {
  if (factory !== undefined) {
    return factory;
  }

  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment');
  }

  return indexedDB;
};

const settleTransaction = async (
  transaction: TransactionHandleValue,
  enqueue: (requests: Promise<unknown>[]) => void,
): Promise<void> => {
  const requests: Promise<unknown>[] = [];

  try {
    enqueue(requests);
  }
  catch (error) {
    transaction.abort();
    await Promise.allSettled([...requests, transaction.done]);
    throw error;
  }

  await Promise.all([...requests, transaction.done]);
};

const readCollection = async (
  transaction: EngineTransactionValue<'readonly'>,
  name: EngineCollectionName,
): Promise<CollectionEntryValue> => {
  const store = transaction.objectStore(name);
  const [keys, values]: [unknown[], unknown[]] = await Promise.all([store.getAllKeys(), store.getAll()]);
  const records = new Map<string, StoredRecordValue>();

  keys.forEach((key, index) => {
    const record = values[index];

    if (!isStoredRecord(record)) {
      throw new Error(`The engine database holds a malformed record in ${name}`);
    }

    records.set(readStoreKey(key), record);
  });

  return [name, records];
};

const enqueueCollectionPuts = (
  transaction: EngineTransactionValue<'readwrite'>,
  name: EngineCollectionName,
  records: EngineCollectionValue,
  requests: Promise<unknown>[],
): void => {
  const store = transaction.objectStore(name);

  for (const [id, record] of records) {
    requests.push(store.put(record, id));
  }
};

export const createIndexedDbStorage = async (options: CreateIndexedDbStorageOptionsValue): Promise<IIndexedDbEngineStorage> => {
  const database = await openDatabase(
    resolveFactory(options.factory),
    options.databaseName,
    options.version ?? INDEXED_DB_VERSION,
  );

  const openTransaction = <TMode extends IDBTransactionMode>(
    storeNames: readonly string[],
    mode: TMode,
  ): EngineTransactionValue<TMode> => database.transaction([...storeNames], mode);

  const load = async (): Promise<EngineSnapshotValue | undefined> => {
    const transaction = openTransaction(ALL_STORE_NAMES, 'readonly');
    const metaStore = transaction.objectStore(META_STORE_NAME);
    const schemaVersionRequest: Promise<unknown> = metaStore.get(SCHEMA_VERSION_KEY);
    const metaRequest: Promise<unknown> = metaStore.get(ENGINE_META_KEY);
    const collectionRequests = Promise.all(ENGINE_COLLECTION_NAMES.map(name => readCollection(transaction, name)));
    const [schemaVersion, meta, entries] = await Promise.all([
      schemaVersionRequest,
      metaRequest,
      collectionRequests,
      transaction.done,
    ]);

    if (schemaVersion === undefined && meta === undefined) {
      return undefined;
    }

    if (typeof schemaVersion !== 'number' || !isEngineMeta(meta)) {
      throw new Error('The engine database holds a malformed snapshot header');
    }

    const collections = createEmptyCollections();

    for (const [name, records] of entries) {
      collections[name] = records;
    }

    return { collections, meta, schemaVersion };
  };

  const commit = async (changeSet: EngineChangeSetValue): Promise<void> => {
    const touchedNames = ENGINE_COLLECTION_NAMES.filter(
      name => (changeSet.puts[name]?.size ?? 0) > 0 || (changeSet.deletes[name]?.length ?? 0) > 0,
    );
    const transaction = openTransaction([...touchedNames, META_STORE_NAME], 'readwrite');

    await settleTransaction(transaction, (requests) => {
      for (const name of touchedNames) {
        const store = transaction.objectStore(name);

        for (const id of changeSet.deletes[name] ?? []) {
          requests.push(store.delete(id));
        }

        enqueueCollectionPuts(transaction, name, changeSet.puts[name] ?? new Map(), requests);
      }

      requests.push(transaction.objectStore(META_STORE_NAME).put(changeSet.meta, ENGINE_META_KEY));
    });
  };

  const replaceAll = async (snapshot: EngineSnapshotValue): Promise<void> => {
    const transaction = openTransaction(ALL_STORE_NAMES, 'readwrite');

    await settleTransaction(transaction, (requests) => {
      for (const name of ALL_STORE_NAMES) {
        requests.push(transaction.objectStore(name).clear());
      }

      for (const name of ENGINE_COLLECTION_NAMES) {
        enqueueCollectionPuts(transaction, name, snapshot.collections[name], requests);
      }

      const metaStore = transaction.objectStore(META_STORE_NAME);

      requests.push(metaStore.put(snapshot.schemaVersion, SCHEMA_VERSION_KEY));
      requests.push(metaStore.put(snapshot.meta, ENGINE_META_KEY));
    });
  };

  const clear = async (): Promise<void> => {
    const transaction = openTransaction(ALL_STORE_NAMES, 'readwrite');

    await settleTransaction(transaction, (requests) => {
      for (const name of ALL_STORE_NAMES) {
        requests.push(transaction.objectStore(name).clear());
      }
    });
  };

  const close = (): void => {
    database.close();
  };

  return {
    clear,
    close,
    commit,
    load,
    replaceAll,
  };
};
