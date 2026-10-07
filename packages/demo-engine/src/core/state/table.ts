import type {
  EngineCollectionValue,
  StoredRecordValue,
} from '../ports/index';
import type { TableDefinition } from './tables';

export interface CollectionChangeValue {
  deletes: string[];
  puts: Map<string, StoredRecordValue>;
}

export interface ITable<TRecord, TIndex extends string> {
  clear: () => void;
  createOverlay: () => ITableOverlay<TRecord>;
  definition: TableDefinition<TRecord, TIndex>;
  encodeAll: () => Map<string, StoredRecordValue>;
  get: (id: string) => TRecord | undefined;
  ids: () => string[];
  idsByIndex: (index: TIndex, key: string) => string[];
  load: (collection: EngineCollectionValue) => void;
}

export interface ITableOverlay<TRecord> {
  apply: () => void;
  describeChange: () => CollectionChangeValue;
  entries: Map<string, TRecord | undefined>;
}

export const compareIds = (current: string, next: string): number => {
  if (current === next) {
    return 0;
  }

  return current < next ? -1 : 1;
};

export const createTable = <TRecord, TIndex extends string>(
  definition: TableDefinition<TRecord, TIndex>,
): ITable<TRecord, TIndex> => {
  const records = new Map<string, TRecord>();
  const bucketsByIndex = new Map<string, Map<string, Set<string>>>(
    Object.keys(definition.indexKeys).map(indexName => [indexName, new Map<string, Set<string>>()]),
  );

  const forEachIndexKey = (record: TRecord, visit: (buckets: Map<string, Set<string>>, key: string) => void): void => {
    for (const [indexName, getKey] of Object.entries<(record: TRecord) => string>(definition.indexKeys)) {
      const buckets = bucketsByIndex.get(indexName);

      if (buckets !== undefined) {
        visit(buckets, getKey(record));
      }
    }
  };

  const removeFromIndexes = (record: TRecord): void => {
    const id = definition.getId(record);

    forEachIndexKey(record, (buckets, key) => {
      const members = buckets.get(key);
      members?.delete(id);

      if (members?.size === 0) {
        buckets.delete(key);
      }
    });
  };

  const addToIndexes = (record: TRecord): void => {
    const id = definition.getId(record);

    forEachIndexKey(record, (buckets, key) => {
      const members = buckets.get(key) ?? new Set<string>();
      members.add(id);
      buckets.set(key, members);
    });
  };

  const remove = (id: string): void => {
    const existing = records.get(id);

    if (existing !== undefined) {
      removeFromIndexes(existing);
      records.delete(id);
    }
  };

  const set = (record: TRecord): void => {
    const id = definition.getId(record);
    remove(id);
    records.set(id, record);
    addToIndexes(record);
  };

  const clear = (): void => {
    records.clear();

    for (const buckets of bucketsByIndex.values()) {
      buckets.clear();
    }
  };

  const load = (collection: EngineCollectionValue): void => {
    clear();

    for (const [id, stored] of collection) {
      const record = definition.decode(stored);

      if (definition.getId(record) !== id) {
        throw new Error(`Record key ${id} does not match the id inside the stored record`);
      }

      set(record);
    }
  };

  const encodeAll = (): Map<string, StoredRecordValue> => new Map(
    [...records.keys()].sort(compareIds).flatMap((id) => {
      const record = records.get(id);

      return record === undefined ? [] : [[id, definition.encode(record)] as const];
    }),
  );

  const createOverlay = (): ITableOverlay<TRecord> => {
    const entries = new Map<string, TRecord | undefined>();

    const apply = (): void => {
      for (const [id, record] of entries) {
        if (record === undefined) {
          remove(id);
        }
        else {
          set(record);
        }
      }
    };

    const describeChange = (): CollectionChangeValue => {
      const change: CollectionChangeValue = { deletes: [], puts: new Map() };

      for (const [id, record] of entries) {
        if (record !== undefined) {
          change.puts.set(id, definition.encode(record));
        }
        else if (records.has(id)) {
          change.deletes.push(id);
        }
      }

      return change;
    };

    return { apply, describeChange, entries };
  };

  return {
    clear,
    createOverlay,
    definition,
    encodeAll,
    get: id => records.get(id),
    ids: () => [...records.keys()],
    idsByIndex: (indexName, key) => [...(bucketsByIndex.get(indexName)?.get(key) ?? [])],
    load,
  };
};
