import type {
  EngineChangeSetValue,
  EngineCollectionName,
  EngineCollectionValue,
  EngineSnapshotValue,
  IEngineStorage,
  StoredRecordValue,
} from './storage';

import { ENGINE_COLLECTION_NAMES } from './storage';

type MutableCollectionsValue = Record<EngineCollectionName, Map<string, StoredRecordValue>>;

interface MutableSnapshotValue {
  collections: MutableCollectionsValue;
  meta: EngineSnapshotValue['meta'];
  schemaVersion: number;
}

const runAsync = <TResult>(operation: () => TResult): Promise<TResult> => new Promise((resolve) => {
  resolve(operation());
});

const cloneCollection = (collection: EngineCollectionValue): Map<string, StoredRecordValue> => structuredClone(new Map(collection));

const cloneSnapshot = (snapshot: EngineSnapshotValue): MutableSnapshotValue => {
  const collections = {} as MutableCollectionsValue;

  for (const name of ENGINE_COLLECTION_NAMES) {
    collections[name] = cloneCollection(snapshot.collections[name]);
  }

  return {
    collections,
    meta: structuredClone(snapshot.meta),
    schemaVersion: snapshot.schemaVersion,
  };
};

const applyChangeSet = (snapshot: MutableSnapshotValue, changeSet: EngineChangeSetValue): MutableSnapshotValue => {
  const clonedMeta = structuredClone(changeSet.meta);
  const clonedPuts = new Map<EngineCollectionName, Map<string, StoredRecordValue>>();

  for (const name of ENGINE_COLLECTION_NAMES) {
    const puts = changeSet.puts[name];

    if (puts !== undefined) {
      clonedPuts.set(name, cloneCollection(puts));
    }
  }

  for (const name of ENGINE_COLLECTION_NAMES) {
    for (const id of changeSet.deletes[name] ?? []) {
      snapshot.collections[name].delete(id);
    }

    for (const [id, record] of clonedPuts.get(name) ?? []) {
      snapshot.collections[name].set(id, record);
    }
  }

  return { collections: snapshot.collections, meta: clonedMeta, schemaVersion: snapshot.schemaVersion };
};

export const createMemoryStorage = (initial?: EngineSnapshotValue): IEngineStorage => {
  let state: MutableSnapshotValue | undefined = initial === undefined ? undefined : cloneSnapshot(initial);

  const commit = (changeSet: EngineChangeSetValue): Promise<void> => runAsync(() => {
    if (state === undefined) {
      throw new Error('Storage holds no snapshot to commit to');
    }

    state = applyChangeSet(state, changeSet);
  });

  const load = (): Promise<EngineSnapshotValue | undefined> => runAsync(() => (state === undefined ? undefined : cloneSnapshot(state)));

  const replaceAll = (snapshot: EngineSnapshotValue): Promise<void> => runAsync(() => {
    state = cloneSnapshot(snapshot);
  });

  return { commit, load, replaceAll };
};
