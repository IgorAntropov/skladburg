import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  SectionLoader,
  SectionLoadersValue,
  SectionModuleValue,
} from './sectionPages';

import { createCachedSectionLoaders } from './createCachedSectionLoaders';

const CHUNK_ERROR = new Error('chunk is unavailable');

const createModule = (): SectionModuleValue => ({ default: () => null });

const createLoaders = (loader: SectionLoader): SectionLoadersValue => ({
  catalog: loader,
  deals: loader,
  network: loader,
  warehouse: loader,
});

describe('createCachedSectionLoaders', () => {
  it('shares one loading between the calls made while the module is loading', async () => {
    const loadedModule = createModule();
    const loader = vi.fn<SectionLoader>(() => Promise.resolve(loadedModule));
    const { deals } = createCachedSectionLoaders(createLoaders(loader));

    const first = deals();
    const second = deals();

    expect(loader).toHaveBeenCalledOnce();
    expect(await first).toBe(loadedModule);
    expect(await second).toBe(loadedModule);
  });

  it('does not call the source loader again once the module is loaded', async () => {
    const loader = vi.fn<SectionLoader>(() => Promise.resolve(createModule()));
    const { network } = createCachedSectionLoaders(createLoaders(loader));

    await network();
    await network();
    await network();

    expect(loader).toHaveBeenCalledOnce();
  });

  it('calls the callback at once when the module is already loaded', async () => {
    const loadedModule = createModule();
    const { catalog } = createCachedSectionLoaders(createLoaders(() => Promise.resolve(loadedModule)));
    await catalog();
    const onFulfilled = vi.fn((module: SectionModuleValue): SectionModuleValue => module);

    catalog().then(onFulfilled);

    expect(onFulfilled).toHaveBeenCalledOnce();
    expect(onFulfilled).toHaveBeenCalledWith(loadedModule);
  });

  it('gives the result of the callback to the next step when the module is already loaded', async () => {
    const { warehouse } = createCachedSectionLoaders(createLoaders(() => Promise.resolve(createModule())));
    await warehouse();

    const title = await warehouse().then(() => 'ready');

    expect(title).toBe('ready');
  });

  it('keeps the loading of every section apart', async () => {
    const catalogModule = createModule();
    const dealsModule = createModule();
    const cached = createCachedSectionLoaders({
      catalog: () => Promise.resolve(catalogModule),
      deals: () => Promise.resolve(dealsModule),
      network: () => Promise.resolve(createModule()),
      warehouse: () => Promise.resolve(createModule()),
    });

    expect(await cached.catalog()).toBe(catalogModule);
    expect(await cached.deals()).toBe(dealsModule);
  });

  it('passes the error through, forgets the failed loading and tries again on the next call', async () => {
    const loadedModule = createModule();
    const loader = vi.fn<SectionLoader>()
      .mockRejectedValueOnce(CHUNK_ERROR)
      .mockResolvedValueOnce(loadedModule);
    const { deals } = createCachedSectionLoaders(createLoaders(loader));

    await expect(deals()).rejects.toBe(CHUNK_ERROR);
    expect(await deals()).toBe(loadedModule);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('shares the failure between the calls made during the same loading', async () => {
    const loader = vi.fn<SectionLoader>().mockRejectedValue(CHUNK_ERROR);
    const { deals } = createCachedSectionLoaders(createLoaders(loader));

    const results = await Promise.allSettled([deals(), deals()]);

    expect(results.map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(loader).toHaveBeenCalledOnce();
  });
});
