import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  EngineChangeSetValue,
  IEngineStorage,
} from '../core/ports/index';
import type { StorageHealthValue } from './storageHealthMonitor';

import { createMemoryStorage } from '../core/ports/index';
import { createSeedSnapshot } from '../core/seed/index';
import { createStorageHealthMonitor } from './storageHealthMonitor';

const SNAPSHOT = createSeedSnapshot();
const EMPTY_CHANGE_SET: EngineChangeSetValue = { deletes: {}, meta: SNAPSHOT.meta, puts: {} };

const createControlledStorage = (): { fail: (isFailing: boolean) => void; storage: IEngineStorage } => {
  const inner = createMemoryStorage(SNAPSHOT);
  let isFailing = false;

  return {
    fail: (next) => {
      isFailing = next;
    },
    storage: {
      commit: (changeSet) => {
        if (isFailing) {
          return Promise.reject(new Error('The write failed'));
        }

        return inner.commit(changeSet);
      },
      load: () => inner.load(),
      replaceAll: (snapshot) => {
        if (isFailing) {
          return Promise.reject(new Error('The write failed'));
        }

        return inner.replaceAll(snapshot);
      },
    },
  };
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('storage health monitor', () => {
  it('starts healthy and stays silent while the writes succeed', async () => {
    const changes: StorageHealthValue[] = [];
    const monitor = createStorageHealthMonitor({ onChange: health => changes.push(health) });
    const { storage } = createControlledStorage();
    const wrapped = monitor.wrap(storage);

    await wrapped.commit(EMPTY_CHANGE_SET);

    expect(monitor.health()).toBe('ok');
    expect(changes).toEqual([]);
    expect(console.log).not.toHaveBeenCalled();
  });

  it('turns failing on a rejected commit, rethrows the original error and reports the change once', async () => {
    const changes: StorageHealthValue[] = [];
    const monitor = createStorageHealthMonitor({ onChange: health => changes.push(health) });
    const controlled = createControlledStorage();
    const wrapped = monitor.wrap(controlled.storage);
    controlled.fail(true);

    await expect(wrapped.commit(EMPTY_CHANGE_SET)).rejects.toThrow('The write failed');
    await expect(wrapped.commit(EMPTY_CHANGE_SET)).rejects.toThrow('The write failed');

    expect(monitor.health()).toBe('failing');
    expect(changes).toEqual(['failing']);
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('> EngineHost -> storageHealth:', {
      error: new Error('The write failed'),
      health: 'failing',
    });
  });

  it('turns failing on a rejected replaceAll', async () => {
    const changes: StorageHealthValue[] = [];
    const monitor = createStorageHealthMonitor({ onChange: health => changes.push(health) });
    const controlled = createControlledStorage();
    const wrapped = monitor.wrap(controlled.storage);
    controlled.fail(true);

    await expect(wrapped.replaceAll(SNAPSHOT)).rejects.toThrow('The write failed');

    expect(changes).toEqual(['failing']);
  });

  it('turns healthy again on the next successful write and logs each change once', async () => {
    const changes: StorageHealthValue[] = [];
    const monitor = createStorageHealthMonitor({ onChange: health => changes.push(health) });
    const controlled = createControlledStorage();
    const wrapped = monitor.wrap(controlled.storage);
    controlled.fail(true);
    await expect(wrapped.commit(EMPTY_CHANGE_SET)).rejects.toThrow();
    controlled.fail(false);

    await wrapped.commit(EMPTY_CHANGE_SET);
    await wrapped.commit(EMPTY_CHANGE_SET);

    expect(monitor.health()).toBe('ok');
    expect(changes).toEqual(['failing', 'ok']);
    expect(console.log).toHaveBeenCalledTimes(2);
  });

  it('does not treat a failed load as a write failure', async () => {
    const monitor = createStorageHealthMonitor({ onChange: () => undefined });
    const wrapped = monitor.wrap({
      commit: () => Promise.resolve(),
      load: () => Promise.reject(new Error('The snapshot is damaged')),
      replaceAll: () => Promise.resolve(),
    });

    await expect(wrapped.load()).rejects.toThrow('The snapshot is damaged');

    expect(monitor.health()).toBe('ok');
  });
});
