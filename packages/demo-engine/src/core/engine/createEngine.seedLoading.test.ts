import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createMemoryStorage } from '../ports/index';
import { createSeedSnapshot } from '../seed/seedSnapshot';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('../seed/seedSnapshot');
  vi.restoreAllMocks();
});

describe('engine seed loading', () => {
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
