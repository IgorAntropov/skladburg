import type {
  EngineChangeSetValue,
  EngineCollectionName,
  EngineCollectionValue,
  EngineMetaValue,
  EngineSnapshotValue,
} from '../ports/index';
import type {
  IStateReader,
  OverlaysValue,
  TablesValue,
} from './stateReader';
import type {
  TableName,
  TableRecordsValue,
} from './tables';

import {
  createEmptyCollections,
  ENGINE_COLLECTION_NAMES,
} from '../ports/index';
import { ENGINE_SCHEMA_VERSION } from './schemaVersion';
import { createReader } from './stateReader';
import { createTable } from './table';
import { TABLE_DEFINITIONS } from './tables';

export interface IEngineState {
  getChannelSeq: (channel: string) => bigint;
  getMeta: () => EngineMetaValue;
  read: IStateReader;
  replaceAll: (snapshot: EngineSnapshotValue) => void;
  toSnapshot: (volatileMeta: VolatileMetaValue) => EngineSnapshotValue;
  transact: <TResult>(
    worldTimeMs: number,
    work: (transaction: IStateTransaction) => TResult,
    readLiveMeta: () => LiveMetaValue,
  ) => TransactionOutcomeValue<TResult>;
}

export interface IStateTransaction extends IStateReader {
  delete: (table: TableName, id: string) => void;
  nextChannelSeq: (channel: string) => bigint;
  put: <TName extends TableName>(table: TName, record: TableRecordsValue[TName]) => void;
  readonly worldTimeMs: number;
}

export type LiveMetaValue = Pick<EngineMetaValue, 'randomState' | 'timeScale' | 'traceRandomState'>;

export interface TransactionOutcomeValue<TResult> {
  apply: () => void;
  changeSet: EngineChangeSetValue | undefined;
  result: TResult;
}

export type VolatileMetaValue = Pick<EngineMetaValue, 'randomState' | 'timeScale' | 'traceRandomState' | 'worldTimeMs'>;

const createTables = (): TablesValue => ({
  boardNodes: createTable(TABLE_DEFINITIONS.boardNodes),
  cities: createTable(TABLE_DEFINITIONS.cities),
  idempotency: createTable(TABLE_DEFINITIONS.idempotency),
  memberships: createTable(TABLE_DEFINITIONS.memberships),
  organizations: createTable(TABLE_DEFINITIONS.organizations),
  organizationSettings: createTable(TABLE_DEFINITIONS.organizationSettings),
  personas: createTable(TABLE_DEFINITIONS.personas),
  roles: createTable(TABLE_DEFINITIONS.roles),
  spheres: createTable(TABLE_DEFINITIONS.spheres),
  users: createTable(TABLE_DEFINITIONS.users),
  warehouses: createTable(TABLE_DEFINITIONS.warehouses),
});

const createOverlays = (tables: TablesValue): OverlaysValue => ({
  boardNodes: tables.boardNodes.createOverlay(),
  cities: tables.cities.createOverlay(),
  idempotency: tables.idempotency.createOverlay(),
  memberships: tables.memberships.createOverlay(),
  organizations: tables.organizations.createOverlay(),
  organizationSettings: tables.organizationSettings.createOverlay(),
  personas: tables.personas.createOverlay(),
  roles: tables.roles.createOverlay(),
  spheres: tables.spheres.createOverlay(),
  users: tables.users.createOverlay(),
  warehouses: tables.warehouses.createOverlay(),
});

export const createEngineState = (initial: EngineSnapshotValue): IEngineState => {
  const tables = createTables();
  let meta: EngineMetaValue = structuredClone(initial.meta);
  let revision = 0;

  const loadSnapshot = (snapshot: EngineSnapshotValue): void => {
    for (const name of ENGINE_COLLECTION_NAMES) {
      tables[name].load(snapshot.collections[name]);
    }

    meta = structuredClone(snapshot.meta);
    revision += 1;
  };

  const read = createReader(tables, createOverlays(tables));

  const getChannelSeq = (channel: string): bigint => meta.channelSeq[channel] ?? 0n;

  const toSnapshot = (volatileMeta: VolatileMetaValue): EngineSnapshotValue => {
    const collections = createEmptyCollections();

    for (const name of ENGINE_COLLECTION_NAMES) {
      collections[name] = tables[name].encodeAll();
    }

    return {
      collections,
      meta: { ...structuredClone(meta), ...structuredClone(volatileMeta) },
      schemaVersion: ENGINE_SCHEMA_VERSION,
    };
  };

  const transact = <TResult>(
    worldTimeMs: number,
    work: (transaction: IStateTransaction) => TResult,
    readLiveMeta: () => LiveMetaValue,
  ): TransactionOutcomeValue<TResult> => {
    const overlays = createOverlays(tables);
    const pendingSeq = new Map<string, bigint>();
    const baseRevision = revision;

    const transaction: IStateTransaction = {
      ...createReader(tables, overlays),
      delete: (table, id) => {
        overlays[table].entries.set(id, undefined);
      },
      nextChannelSeq: (channel) => {
        const next = (pendingSeq.get(channel) ?? getChannelSeq(channel)) + 1n;
        pendingSeq.set(channel, next);

        return next;
      },
      put: (table, record) => {
        const { definition } = tables[table];

        if (definition.getId(record) === '') {
          throw new Error(`Cannot put a ${table} record without an id`);
        }

        overlays[table].entries.set(definition.getId(record), definition.clone(record));
      },
      worldTimeMs,
    };

    const result = work(transaction);
    const puts: Partial<Record<EngineCollectionName, EngineCollectionValue>> = {};
    const deletes: Partial<Record<EngineCollectionName, readonly string[]>> = {};

    for (const name of ENGINE_COLLECTION_NAMES) {
      const change = overlays[name].describeChange();

      if (change.puts.size > 0) {
        puts[name] = change.puts;
      }

      if (change.deletes.length > 0) {
        deletes[name] = change.deletes;
      }
    }

    const hasChanges = pendingSeq.size > 0 || Object.keys(puts).length > 0 || Object.keys(deletes).length > 0;

    if (!hasChanges) {
      return { apply: () => undefined, changeSet: undefined, result };
    }

    const changeSet: EngineChangeSetValue = {
      deletes,
      meta: {
        ...structuredClone(meta),
        ...structuredClone(readLiveMeta()),
        channelSeq: { ...meta.channelSeq, ...Object.fromEntries(pendingSeq) },
        worldTimeMs,
      },
      puts,
    };

    const apply = (): void => {
      if (revision !== baseRevision) {
        throw new Error('The state changed after the transaction was prepared');
      }

      for (const name of ENGINE_COLLECTION_NAMES) {
        overlays[name].apply();
      }

      meta = structuredClone(changeSet.meta);
      revision += 1;
    };

    return { apply, changeSet, result };
  };

  loadSnapshot(initial);

  return {
    getChannelSeq,
    getMeta: () => structuredClone(meta),
    read,
    replaceAll: loadSnapshot,
    toSnapshot,
    transact,
  };
};
