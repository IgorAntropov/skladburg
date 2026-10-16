import type { Mock } from 'vitest';

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { AppSectionValue } from '@/shared/routing';

import { APP_SECTIONS } from '@/shared/routing';

import type { SectionLoader } from './sectionPages';

import {
  findStartSection,
  prewarmStartSection,
} from './prewarmStartSection';

type MockSectionLoadersValue = Record<AppSectionValue, Mock<SectionLoader>>;

const createLoader = (): Mock<SectionLoader> => vi.fn<SectionLoader>(() => Promise.resolve({ default: () => null }));

const createLoaders = (): MockSectionLoadersValue => ({
  catalog: createLoader(),
  deals: createLoader(),
  network: createLoader(),
  warehouse: createLoader(),
});

describe('findStartSection', () => {
  it('takes the section from a section address', () => {
    expect(findStartSection('/warehouse')).toBe('warehouse');
  });

  it('takes the home section of an object address', () => {
    expect(findStartSection('/deals/deal-1')).toBe('deals');
  });

  it('takes the first section for the address without a section', () => {
    expect(findStartSection('/')).toBe(APP_SECTIONS[0]);
  });

  it('finds no section for an address the application does not know', () => {
    expect(findStartSection('/nowhere')).toBeUndefined();
  });
});

describe('prewarmStartSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts loading the section of the address and no other section', () => {
    const loaders = createLoaders();

    prewarmStartSection({ loaders, path: '/catalog' });

    expect(loaders.catalog).toHaveBeenCalledOnce();
    expect(loaders.network).not.toHaveBeenCalled();
    expect(loaders.deals).not.toHaveBeenCalled();
    expect(loaders.warehouse).not.toHaveBeenCalled();
  });

  it('starts loading the first section for the address without a section', () => {
    const loaders = createLoaders();

    prewarmStartSection({ loaders, path: '/' });

    expect(loaders.network).toHaveBeenCalledOnce();
  });

  it('loads nothing for an unknown address', () => {
    const loaders = createLoaders();

    prewarmStartSection({ loaders, path: '/nowhere' });

    expect(loaders.network).not.toHaveBeenCalled();
    expect(loaders.catalog).not.toHaveBeenCalled();
  });

  it('logs a rejected load and does not throw', async () => {
    const error = new Error('Failed to fetch dynamically imported module');
    const loaders = createLoaders();
    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    loaders.network.mockRejectedValue(error);

    expect(() => {
      prewarmStartSection({ loaders, path: '/network' });
    }).not.toThrow();
    await vi.waitFor(() => {
      expect(logError).toHaveBeenCalledWith('> mountApp -> prewarmStartSection:', { error, section: 'network' });
    });
  });

  it('logs a loader that throws before returning a promise and does not throw', async () => {
    const error = new Error('loader failed');
    const loaders = createLoaders();
    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    loaders.network.mockImplementation(() => {
      throw error;
    });

    expect(() => {
      prewarmStartSection({ loaders, path: '/network' });
    }).not.toThrow();
    await vi.waitFor(() => {
      expect(logError).toHaveBeenCalledWith('> mountApp -> prewarmStartSection:', { error, section: 'network' });
    });
  });
});
