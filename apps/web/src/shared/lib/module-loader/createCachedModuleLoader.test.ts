import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  MapLoadErrorFunction,
  ModuleLoader,
} from './createCachedModuleLoader';

import { ChunkLoadError } from './ChunkLoadError';
import { createCachedModuleLoader } from './createCachedModuleLoader';

interface TestModuleValue {
  name: string;
}

const LOAD_ERROR = new Error('module is unavailable');

const createModule = (name = 'module'): TestModuleValue => ({ name });

const createLoader = (loadedModule: TestModuleValue = createModule()): ReturnType<typeof vi.fn<ModuleLoader<TestModuleValue>>> => {
  return vi.fn<ModuleLoader<TestModuleValue>>(() => Promise.resolve(loadedModule));
};

describe('createCachedModuleLoader', () => {
  it('does not call the source loader until the first call', () => {
    const loader = createLoader();

    createCachedModuleLoader(loader);

    expect(loader).not.toHaveBeenCalled();
  });

  it('shares one loading between the calls made while the module is loading', async () => {
    const loadedModule = createModule();
    const loader = createLoader(loadedModule);
    const load = createCachedModuleLoader(loader);

    const first = load();
    const second = load();

    expect(loader).toHaveBeenCalledOnce();
    expect(await first).toBe(loadedModule);
    expect(await second).toBe(loadedModule);
  });

  it('does not call the source loader again once the module is loaded', async () => {
    const loader = createLoader();
    const load = createCachedModuleLoader(loader);

    await load();
    await load();
    await load();

    expect(loader).toHaveBeenCalledOnce();
  });

  it('keeps the loading of every cached loader apart', async () => {
    const firstModule = createModule('first');
    const secondModule = createModule('second');
    const loadFirst = createCachedModuleLoader(createLoader(firstModule));
    const loadSecond = createCachedModuleLoader(createLoader(secondModule));

    expect(await loadFirst()).toBe(firstModule);
    expect(await loadSecond()).toBe(secondModule);
  });

  it('calls the callback at once when the module is already loaded', async () => {
    const loadedModule = createModule();
    const load = createCachedModuleLoader(createLoader(loadedModule));
    await load();
    const onFulfilled = vi.fn((module: TestModuleValue): TestModuleValue => module);

    void load().then(onFulfilled);

    expect(onFulfilled).toHaveBeenCalledOnce();
    expect(onFulfilled).toHaveBeenCalledWith(loadedModule);
  });

  it('does not call the callback at once while the module is loading', async () => {
    const load = createCachedModuleLoader(createLoader());
    const onFulfilled = vi.fn((module: TestModuleValue): TestModuleValue => module);

    const result = load().then(onFulfilled);

    expect(onFulfilled).not.toHaveBeenCalled();
    await result;
    expect(onFulfilled).toHaveBeenCalledOnce();
  });

  it('gives the result of the callback to the next step when the module is already loaded', async () => {
    const load = createCachedModuleLoader(createLoader());
    await load();

    const title = await load().then(() => 'ready');

    expect(title).toBe('ready');
  });

  it('lets one thenable of the loaded module be awaited twice', async () => {
    const loadedModule = createModule();
    const load = createCachedModuleLoader(createLoader(loadedModule));
    await load();
    const loaded = load();

    expect(await loaded.then(module => module.name)).toBe(loadedModule.name);
    expect(await loaded.then(module => module === loadedModule)).toBe(true);
  });

  it('resolves to the module when the loaded module is awaited without callbacks', async () => {
    const loadedModule = createModule();
    const load = createCachedModuleLoader(createLoader(loadedModule));
    await load();

    expect(await load().then()).toBe(loadedModule);
    expect(await load().then(undefined, undefined)).toBe(loadedModule);
    expect(await load().then(null, null)).toBe(loadedModule);
  });

  it('does not call the rejection callback for the loaded module', async () => {
    const loadedModule = createModule();
    const load = createCachedModuleLoader(createLoader(loadedModule));
    await load();
    const onRejected = vi.fn<(reason: unknown) => void>();

    const result = await load().then(module => module === loadedModule, onRejected);

    expect(result).toBe(true);
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('rejects when the callback of the loaded module throws', async () => {
    const load = createCachedModuleLoader(createLoader());
    await load();

    await expect(load().then(() => {
      throw new Error('callback failed');
    })).rejects.toThrow('callback failed');
  });

  it('rejects with the chunk error that keeps the source error, forgets the failure and tries again on the next call', async () => {
    const loadedModule = createModule();
    const loader = vi.fn<ModuleLoader<TestModuleValue>>()
      .mockRejectedValueOnce(LOAD_ERROR)
      .mockResolvedValueOnce(loadedModule);
    const load = createCachedModuleLoader(loader);

    const failure: unknown = await load().then(() => undefined, (error: unknown) => error);

    expect(failure).toBeInstanceOf(ChunkLoadError);
    expect(failure).toMatchObject({ attempt: 1, cause: LOAD_ERROR, name: 'ChunkLoadError' });
    expect(await load()).toBe(loadedModule);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('shares the failure between the calls made during the same loading and counts it once', async () => {
    const loader = vi.fn<ModuleLoader<TestModuleValue>>().mockRejectedValue(LOAD_ERROR);
    const load = createCachedModuleLoader(loader);

    const results = await Promise.allSettled([load(), load()]);

    expect(results.map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(results).toMatchObject([{ reason: { attempt: 1 } }, { reason: { attempt: 1 } }]);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('counts the attempts of one loader and stops loading after a success', async () => {
    const loader = vi.fn<ModuleLoader<TestModuleValue>>()
      .mockRejectedValueOnce(LOAD_ERROR)
      .mockRejectedValueOnce(LOAD_ERROR)
      .mockResolvedValueOnce(createModule());
    const load = createCachedModuleLoader(loader);

    const first: unknown = await load().then(() => undefined, (error: unknown) => error);
    const second: unknown = await load().then(() => undefined, (error: unknown) => error);
    await load();
    await load();

    expect(first).toMatchObject({ attempt: 1 });
    expect(second).toMatchObject({ attempt: 2 });
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('keeps the attempts of every loader apart', async () => {
    const loadFirst = createCachedModuleLoader(vi.fn<ModuleLoader<TestModuleValue>>().mockRejectedValue(LOAD_ERROR));
    const loadSecond = createCachedModuleLoader(vi.fn<ModuleLoader<TestModuleValue>>().mockRejectedValue(LOAD_ERROR));

    await loadFirst().then(undefined, () => undefined);
    const failure: unknown = await loadSecond().then(() => undefined, (error: unknown) => error);

    expect(failure).toMatchObject({ attempt: 1 });
  });

  it('rejects with the error from mapLoadError that gets the attempt and the source error', async () => {
    class TestChunkLoadError extends ChunkLoadError {}
    const loadedModule = createModule();
    const loader = vi.fn<ModuleLoader<TestModuleValue>>()
      .mockRejectedValueOnce(LOAD_ERROR)
      .mockRejectedValueOnce(LOAD_ERROR)
      .mockResolvedValueOnce(loadedModule);
    const load = createCachedModuleLoader(loader, {
      mapLoadError: ({ attempt, cause }) => new TestChunkLoadError(attempt, 'mapped', { cause }),
    });

    const first: unknown = await load().then(() => undefined, (error: unknown) => error);
    const second: unknown = await load().then(() => undefined, (error: unknown) => error);

    expect(first).toBeInstanceOf(TestChunkLoadError);
    expect(first).toMatchObject({ attempt: 1, cause: LOAD_ERROR, message: 'mapped' });
    expect(second).toMatchObject({ attempt: 2 });
    expect(await load()).toBe(loadedModule);
  });

  it('does not map anything when the module is loaded', async () => {
    const loadedModule = createModule();
    const mapLoadError = vi.fn<MapLoadErrorFunction>();
    const load = createCachedModuleLoader(createLoader(loadedModule), { mapLoadError });

    expect(await load()).toBe(loadedModule);
    expect(mapLoadError).not.toHaveBeenCalled();
  });
});
