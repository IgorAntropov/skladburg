import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { CreateEngineOptionsValue } from '../core/engine/index';
import type { IEngineStorage } from '../core/ports/index';
import type { CoreModuleValue } from './hostTypes';

import { createEngine } from '../core/engine/createEngine';
import { createFakeRealTime } from '../core/engine/testing/engineHarness';
import { createMemoryStorage } from '../core/ports/index';
import { startEngine } from './engineStartup';
import { createStorageHealthMonitor } from './storageHealthMonitor';
import { createFakeIndexedDbStorage } from './testing/fakeIndexedDbStorage';

const createFailingLoad = (inner: IEngineStorage, failures: { count: number }): IEngineStorage => ({
  commit: changeSet => inner.commit(changeSet),
  load: () => {
    if (failures.count > 0) {
      failures.count -= 1;

      return Promise.reject(new Error('The snapshot is damaged'));
    }

    return inner.load();
  },
  replaceAll: snapshot => inner.replaceAll(snapshot),
});

const createIdGenerator = (): (() => string) => {
  let counter = 0;

  return () => {
    counter += 1;

    return `epoch-${String(counter)}`;
  };
};

const createHealthMonitor = (): ReturnType<typeof createStorageHealthMonitor> =>
  createStorageHealthMonitor({ onChange: () => undefined });

const loadCore = (): Promise<CoreModuleValue> => Promise.resolve({ createEngine });

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('startEngine', () => {
  it('starts on IndexedDB storage and gives it the generated epoch', async () => {
    const storage = createFakeIndexedDbStorage();

    const started = await startEngine({
      generateId: createIdGenerator(),
      loadCore,
      openStorage: () => Promise.resolve({ kind: 'indexed-db', storage }),
      realTime: createFakeRealTime(),
      storageHealthMonitor: createHealthMonitor(),
    });

    expect(started.storage).toBe('indexed-db');
    expect(started.engine.epoch()).toBe('epoch-1');
    expect(storage.clearCount()).toBe(0);

    started.closeStorage();

    expect(storage.closeCount()).toBe(1);
  });

  it('starts on memory storage without touching IndexedDB when it is opened as memory', async () => {
    const started = await startEngine({
      generateId: createIdGenerator(),
      loadCore,
      openStorage: () => Promise.resolve({ kind: 'memory', storage: createMemoryStorage() }),
      realTime: createFakeRealTime(),
      storageHealthMonitor: createHealthMonitor(),
    });

    expect(started.storage).toBe('memory');
  });

  it('clears the database and retries once when the first load fails', async () => {
    const failures = { count: 1 };
    const storage = createFakeIndexedDbStorage(createFailingLoad(createMemoryStorage(), failures));
    const createdEpochs: string[] = [];

    const started = await startEngine({
      generateId: createIdGenerator(),
      loadCore: () => Promise.resolve({
        createEngine: (options: CreateEngineOptionsValue) => {
          createdEpochs.push(options.epoch);

          return createEngine(options);
        },
      }),
      openStorage: () => Promise.resolve({ kind: 'indexed-db', storage }),
      realTime: createFakeRealTime(),
      storageHealthMonitor: createHealthMonitor(),
    });

    expect(storage.clearCount()).toBe(1);
    expect(started.storage).toBe('indexed-db');
    expect(createdEpochs).toEqual(['epoch-1', 'epoch-2']);
    expect(started.engine.epoch()).toBe('epoch-2');
    expect(storage.closeCount()).toBe(0);
  });

  it('falls back to memory and closes the database when the load fails again after the clear', async () => {
    const storage = createFakeIndexedDbStorage(createFailingLoad(createMemoryStorage(), { count: 2 }));

    const started = await startEngine({
      generateId: createIdGenerator(),
      loadCore,
      openStorage: () => Promise.resolve({ kind: 'indexed-db', storage }),
      realTime: createFakeRealTime(),
      storageHealthMonitor: createHealthMonitor(),
    });

    expect(storage.clearCount()).toBe(1);
    expect(storage.closeCount()).toBe(1);
    expect(started.storage).toBe('memory');
    expect(started.engine.epoch()).toBe('epoch-3');
  });

  it('reports the health of the memory fallback as ok after the IndexedDB writes failed', async () => {
    const storage = createFakeIndexedDbStorage();
    storage.failWrites(new Error('The quota is exceeded'));
    const changes: string[] = [];
    const storageHealthMonitor = createStorageHealthMonitor({ onChange: health => changes.push(health) });

    const started = await startEngine({
      generateId: createIdGenerator(),
      loadCore,
      openStorage: () => Promise.resolve({ kind: 'indexed-db', storage }),
      realTime: createFakeRealTime(),
      storageHealthMonitor,
    });

    expect(started.storage).toBe('memory');
    expect(started.storageHealth).toBe('ok');
    expect(changes).toEqual(['failing']);
  });

  it('gives the engine a storage watched by the health monitor', async () => {
    const storage = createFakeIndexedDbStorage();
    const changes: string[] = [];
    const storageHealthMonitor = createStorageHealthMonitor({ onChange: health => changes.push(health) });

    const started = await startEngine({
      generateId: createIdGenerator(),
      loadCore,
      openStorage: () => Promise.resolve({ kind: 'indexed-db', storage }),
      realTime: createFakeRealTime(),
      storageHealthMonitor,
    });
    storage.failWrites(new Error('The quota is exceeded'));
    await started.engine.reset('epoch-reset').catch(() => undefined);

    expect(started.storage).toBe('indexed-db');
    expect(started.storageHealth).toBe('ok');
    expect(changes).toEqual(['failing']);
  });

  it('falls back to memory when the clear itself fails', async () => {
    const storage = createFakeIndexedDbStorage(createFailingLoad(createMemoryStorage(), { count: 1 }));
    storage.clear = () => Promise.reject(new Error('The database is locked'));

    const started = await startEngine({
      generateId: createIdGenerator(),
      loadCore,
      openStorage: () => Promise.resolve({ kind: 'indexed-db', storage }),
      realTime: createFakeRealTime(),
      storageHealthMonitor: createHealthMonitor(),
    });

    expect(started.storage).toBe('memory');
    expect(storage.closeCount()).toBe(1);
  });

  it('falls back to memory when the storage cannot be opened', async () => {
    const started = await startEngine({
      generateId: createIdGenerator(),
      loadCore,
      openStorage: () => Promise.reject(new Error('IndexedDB is not available')),
      realTime: createFakeRealTime(),
      storageHealthMonitor: createHealthMonitor(),
    });

    expect(started.storage).toBe('memory');
    expect(started.engine.listPersonas().length).toBeGreaterThan(0);
  });

  it('rejects when the core cannot be loaded', async () => {
    await expect(startEngine({
      generateId: createIdGenerator(),
      loadCore: () => Promise.reject(new Error('The chunk is missing')),
      openStorage: () => Promise.resolve({ kind: 'memory', storage: createMemoryStorage() }),
      realTime: createFakeRealTime(),
      storageHealthMonitor: createHealthMonitor(),
    })).rejects.toThrow('The chunk is missing');
  });
});
