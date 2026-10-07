import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { OpenedEngineStorageValue } from './openEngineStorage';

import { createSeedSnapshot } from '../../core/seed/index';
import {
  createIndexedDbStorage,
  INDEXED_DB_VERSION,
} from './indexedDbStorage';
import { openEngineStorage } from './openEngineStorage';

const DATABASE_NAME = 'engine-open-test';

class ThrowingFactory extends IDBFactory {
  public override open(): never {
    throw new Error('IndexedDB is blocked by the browser');
  }
}

const openedStorages: OpenedEngineStorageValue[] = [];

const openTracked = async (factory?: IDBFactory, version?: number): Promise<OpenedEngineStorageValue> => {
  const opened = await openEngineStorage({ databaseName: DATABASE_NAME, factory, version });

  openedStorages.push(opened);

  return opened;
};

const createFactoryWithNewerDatabase = async (): Promise<IDBFactory> => {
  const factory = new IDBFactory();
  const request = factory.open(DATABASE_NAME, INDEXED_DB_VERSION + 1);

  await new Promise<void>((resolve, reject) => {
    request.addEventListener('success', () => {
      request.result.close();
      resolve();
    });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('The database did not open'));
    });
  });

  return factory;
};

const openForeignConnection = (factory: IDBFactory, version: number): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = factory.open(DATABASE_NAME, version);

  request.addEventListener('success', () => {
    resolve(request.result);
  });
  request.addEventListener('error', () => {
    reject(request.error ?? new Error('The database did not open'));
  });
});

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const opened of openedStorages.splice(0)) {
    if (opened.kind === 'indexed-db') {
      opened.storage.close();
    }
  }

  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('openEngineStorage', () => {
  it('opens IndexedDB when the factory works', async () => {
    const opened = await openTracked(new IDBFactory());

    expect(opened.kind).toBe('indexed-db');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('falls back to memory when the factory throws on open', async () => {
    const opened = await openTracked(new ThrowingFactory());

    expect(opened.kind).toBe('memory');
    expect(console.log).toHaveBeenCalledWith('> openEngineStorage -> createIndexedDbStorage:', expect.objectContaining({
      databaseName: DATABASE_NAME,
    }));
  });

  it('falls back to memory when the open request ends with an error', async () => {
    const opened = await openTracked(await createFactoryWithNewerDatabase());

    expect(opened.kind).toBe('memory');
  });

  it('falls back to memory when the environment has no IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);

    const opened = await openTracked();

    expect(opened.kind).toBe('memory');
  });

  it('opens the global IndexedDB when no factory is given', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());

    const opened = await openTracked();

    expect(opened.kind).toBe('indexed-db');
  });

  it('gives a working storage in the memory fallback', async () => {
    const opened = await openTracked(new ThrowingFactory());
    const snapshot = createSeedSnapshot();

    expect(await opened.storage.load()).toBeUndefined();
    await opened.storage.replaceAll(snapshot);

    expect(await opened.storage.load()).toEqual(snapshot);
  });

  it('falls back to memory when another connection blocks the upgrade and leaves no connection behind', async () => {
    const factory = new IDBFactory();
    const foreign = await openForeignConnection(factory, INDEXED_DB_VERSION);

    const opened = await openTracked(factory, INDEXED_DB_VERSION + 1);

    expect(opened.kind).toBe('memory');
    foreign.close();

    const reopened = await createIndexedDbStorage({
      databaseName: DATABASE_NAME,
      factory,
      version: INDEXED_DB_VERSION + 2,
    });
    reopened.close();
  });
});
