import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ModuleLoader } from './createCachedModuleLoader';

import {
  createCachedModuleLoader,
  toLazyModuleLoader,
} from './createCachedModuleLoader';

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

  it('passes the source error through, forgets the failure and tries again on the next call', async () => {
    const loadedModule = createModule();
    const loader = vi.fn<ModuleLoader<TestModuleValue>>()
      .mockRejectedValueOnce(LOAD_ERROR)
      .mockResolvedValueOnce(loadedModule);
    const load = createCachedModuleLoader(loader);

    const failure: unknown = await load().then(() => undefined, (error: unknown) => error);

    expect(failure).toBe(LOAD_ERROR);
    expect(await load()).toBe(loadedModule);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('shares the failure between the calls made during the same loading', async () => {
    const loader = vi.fn<ModuleLoader<TestModuleValue>>().mockRejectedValue(LOAD_ERROR);
    const load = createCachedModuleLoader(loader);

    const results = await Promise.allSettled([load(), load()]);

    expect(results.map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('rejects with the mapped error that keeps the source error and still forgets the failure', async () => {
    const loadedModule = createModule();
    const loader = vi.fn<ModuleLoader<TestModuleValue>>()
      .mockRejectedValueOnce(LOAD_ERROR)
      .mockResolvedValueOnce(loadedModule);
    const load = createCachedModuleLoader(loader, error => new TypeError('mapped', { cause: error }));

    const failure: unknown = await load().then(() => undefined, (error: unknown) => error);

    expect(failure).toBeInstanceOf(TypeError);
    expect(failure).toMatchObject({ cause: LOAD_ERROR, message: 'mapped' });
    expect(await load()).toBe(loadedModule);
  });

  it('does not map anything when the module is loaded', async () => {
    const loadedModule = createModule();
    const mapLoadError = vi.fn<(error: unknown) => unknown>();
    const load = createCachedModuleLoader(createLoader(loadedModule), mapLoadError);

    expect(await load()).toBe(loadedModule);
    expect(mapLoadError).not.toHaveBeenCalled();
  });
});

describe('toLazyModuleLoader', () => {
  it('keeps the synchronous callback of the cached loader once the module is loaded', async () => {
    const loadedModule = createModule();
    const load = createCachedModuleLoader(createLoader(loadedModule));
    const lazyLoad = toLazyModuleLoader(load);
    await lazyLoad();
    const onFulfilled = vi.fn((module: TestModuleValue): TestModuleValue => module);

    void lazyLoad().then(onFulfilled);

    expect(onFulfilled).toHaveBeenCalledOnce();
    expect(onFulfilled).toHaveBeenCalledWith(loadedModule);
  });

  it('passes the loading error through to the lazy component', async () => {
    const lazyLoad = toLazyModuleLoader(createCachedModuleLoader(vi.fn<ModuleLoader<TestModuleValue>>().mockRejectedValue(LOAD_ERROR)));

    const failure: unknown = await lazyLoad().then(() => undefined, (error: unknown) => error);

    expect(failure).toBe(LOAD_ERROR);
  });
});
