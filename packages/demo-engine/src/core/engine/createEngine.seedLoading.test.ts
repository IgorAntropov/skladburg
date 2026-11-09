import { createClient } from '@connectrpc/connect';
import { NetworkService } from '@skladburg/contracts/network/v1/network';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { callAs } from '../modules/testing/moduleHarness';
import { createMemoryStorage } from '../ports/index';
import {
  SeedCityId,
  SeedUserId,
} from '../seed/seedIds';
import { createSeedSnapshot } from '../seed/seedSnapshot';
import { TABLE_DEFINITIONS } from '../state/index';
import { createEngineTransport } from './testing/engineHarness';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('../seed/seedDealHistory');
  vi.doUnmock('../seed/seedSnapshot');
  vi.restoreAllMocks();
});

describe('engine seed loading', () => {
  it('publishes seeded deal history only on a new world or reset', async () => {
    const { createEngine } = await import('./createEngine');
    const storage = createMemoryStorage();
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    const realTime = { now: (): number => 0 };
    await createEngine({ epoch: 'new', realTime, storage });
    const seeded = await storage.load();

    expect(seeded?.collections.deals.size).toBeGreaterThan(0);
    expect(replaceAll).toHaveBeenCalledTimes(1);

    const restored = await createEngine({ epoch: 'restored', realTime, storage });
    expect(await storage.load()).toEqual(seeded);
    expect(replaceAll).toHaveBeenCalledTimes(1);

    await restored.reset('reset');
    expect(await storage.load()).toEqual(seeded);
    expect(replaceAll).toHaveBeenCalledTimes(2);
  });

  it('serves a city profile for a restored world while preserving its stored deals and documents', async () => {
    const { createEngine } = await import('./createEngine');
    const source = createMemoryStorage();
    const realTime = { now: (): number => 0 };
    await createEngine({ epoch: 'source', realTime, storage: source });
    const snapshot = await source.load();
    const cityRecord = snapshot?.collections.cities.get(SeedCityId.MOSCOW);
    if (snapshot === undefined || cityRecord === undefined) {
      throw new Error('Missing seed city');
    }
    expect(snapshot.collections.deals.size).toBeGreaterThan(0);
    expect(snapshot.collections.documents.size).toBeGreaterThan(0);
    const city = TABLE_DEFINITIONS.cities.decode(cityRecord);
    const cities = new Map(snapshot.collections.cities);
    cities.set(city.id, TABLE_DEFINITIONS.cities.encode({ ...city, localDeliveryProfile: undefined }));
    const stored = { ...snapshot, collections: { ...snapshot.collections, cities } };
    const storage = createMemoryStorage(stored);
    const replaceAll = vi.spyOn(storage, 'replaceAll');

    const engine = await createEngine({ epoch: 'restored', realTime, storage });
    const network = createClient(NetworkService, createEngineTransport(engine, true));
    const response = await network.listCities({}, callAs(SeedUserId.ADMIN_1));

    expect(response.cities.find(item => item.id === city.id)?.localDeliveryProfile).toMatchObject({ distanceKm: 22, driveMinutes: 60 });
    expect(replaceAll).not.toHaveBeenCalled();
    expect(await storage.load()).toEqual(stored);
  });

  it('preserves an incompatible snapshot when deal history cannot load', async () => {
    const snapshot = createSeedSnapshot();
    const stored = { ...snapshot, meta: { ...snapshot.meta, seedVersion: snapshot.meta.seedVersion - 1 } };
    const storage = createMemoryStorage(stored);
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    vi.doMock('../seed/seedDealHistory', () => {
      throw new Error('Deal history chunk is unavailable');
    });
    const { createEngine } = await import('./createEngine');

    await expect(createEngine({ epoch: 'new', realTime: { now: () => 0 }, storage })).rejects.toMatchObject({ name: 'SeedLoadError' });
    expect(replaceAll).not.toHaveBeenCalled();
    expect(await storage.load()).toEqual(stored);
  });

  it('restores a current snapshot when the seed module cannot be loaded', async () => {
    const snapshot = createSeedSnapshot();
    const storage = createMemoryStorage(snapshot);
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    vi.doMock('../seed/seedSnapshot', () => {
      throw new Error('Seed chunk is unavailable');
    });

    const { createEngine } = await import('./createEngine');
    const engine = await createEngine({ epoch: 'restored', realTime: { now: () => 0 }, storage });

    expect(engine.epoch()).toBe('restored');
    expect(engine.listPersonas()).toHaveLength(9);
    expect(replaceAll).not.toHaveBeenCalled();
    expect(await storage.load()).toEqual(snapshot);
  });

  it('classifies a failed seed import before replacing an incompatible snapshot', async () => {
    const snapshot = createSeedSnapshot();
    const stored = { ...snapshot, meta: { ...snapshot.meta, seedVersion: snapshot.meta.seedVersion - 1 } };
    const storage = createMemoryStorage(stored);
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    vi.doMock('../seed/seedSnapshot', () => {
      throw new Error('Seed chunk is unavailable');
    });

    const starting = (async (): Promise<void> => {
      const { createEngine } = await import('./createEngine');
      await createEngine({ epoch: 'new', realTime: { now: () => 0 }, storage });
    })();

    await expect(starting).rejects.toMatchObject({ name: 'SeedLoadError' });
    expect(replaceAll).not.toHaveBeenCalled();
    expect(await storage.load()).toEqual(stored);
  });

  it('keeps the current world and epoch after a failed reset and allows retrying', async () => {
    const snapshot = createSeedSnapshot();
    const storage = createMemoryStorage(snapshot);
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    vi.doMock('../seed/seedSnapshot', () => {
      throw new Error('Seed chunk is unavailable');
    });
    const { createEngine } = await import('./createEngine');
    const seed = { randomSeed: 91, worldStartMs: 10 };
    const engine = await createEngine({ epoch: 'restored', realTime: { now: () => 0 }, seed, storage });
    await engine.checkpoint();
    const stored = await storage.load();
    const clock = engine.getClockSnapshot();
    const personas = engine.listPersonas();

    await expect(engine.reset('reset')).rejects.toMatchObject({ name: 'SeedLoadError' });

    expect(engine.epoch()).toBe('restored');
    expect(engine.getClockSnapshot()).toEqual(clock);
    expect(engine.listPersonas()).toEqual(personas);
    expect(replaceAll).not.toHaveBeenCalled();
    await engine.checkpoint();
    expect(await storage.load()).toEqual(stored);

    vi.doUnmock('../seed/seedSnapshot');
    await engine.reset('retry');

    expect(engine.epoch()).toBe('retry');
    expect(await storage.load()).toEqual(createSeedSnapshot(seed));
  });

  it('does not classify a storage failure as a seed import failure', async () => {
    const storage = createMemoryStorage();
    const failure = new Error('Storage replacement failed');
    vi.spyOn(storage, 'replaceAll').mockRejectedValue(failure);
    const { createEngine } = await import('./createEngine');

    await expect(createEngine({ epoch: 'new', realTime: { now: () => 0 }, storage })).rejects.toBe(failure);
  });

  it('does not classify a seed generation failure as a module import failure', async () => {
    const failure = new Error('Seed generation failed');
    vi.doMock('../seed/seedSnapshot', () => ({
      createSeedSnapshot: (): never => {
        throw failure;
      },
    }));
    const storage = createMemoryStorage();
    const replaceAll = vi.spyOn(storage, 'replaceAll');
    const { createEngine } = await import('./createEngine');

    await expect(createEngine({ epoch: 'new', realTime: { now: () => 0 }, storage })).rejects.toBe(failure);
    expect(replaceAll).not.toHaveBeenCalled();
  });
});
