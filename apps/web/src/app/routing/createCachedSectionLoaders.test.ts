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
import { SectionChunkLoadError } from './SectionChunkLoadError';

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

  it('wraps the failure into the chunk error with the source error, forgets it and tries again on the next call', async () => {
    const loadedModule = createModule();
    const loader = vi.fn<SectionLoader>()
      .mockRejectedValueOnce(CHUNK_ERROR)
      .mockResolvedValueOnce(loadedModule);
    const { deals } = createCachedSectionLoaders(createLoaders(loader));

    const failure: unknown = await deals().then(() => undefined, (error: unknown) => error);

    expect(failure).toBeInstanceOf(SectionChunkLoadError);
    expect(failure).toMatchObject({ cause: CHUNK_ERROR, name: 'SectionChunkLoadError', section: 'deals' });
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

  it('names the section of every loader in its chunk error', async () => {
    const cached = createCachedSectionLoaders(createLoaders(() => Promise.reject(CHUNK_ERROR)));

    for (const section of ['catalog', 'deals', 'network', 'warehouse'] as const) {
      const failure: unknown = await cached[section]().then(() => undefined, (error: unknown) => error);

      expect(failure).toMatchObject({ section });
    }
  });
});
