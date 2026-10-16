import type { Root } from 'react-dom/client';
import type { Mock } from 'vitest';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { AppSectionValue } from '@/shared/routing';

import { createInstallPromptSource } from '@/features/install-app';
import { createApiRuntime } from '@/shared/api';
import { createTestLocalizer } from '@/shared/i18n/index.testing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import type { SectionLoader } from '../routing/sectionPages';

import { createTestThemeStore } from '../lib/testing/themeFixtures';
import { mountApp } from './mountApp';

vi.mock('@/shared/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/api')>();

  return { ...original, createApiRuntime: vi.fn(original.createApiRuntime) };
});

type MockSectionLoadersValue = Record<AppSectionValue, Mock<SectionLoader>>;

const START_FAILURE = new Error('The engine did not start');

const createLoader = (): Mock<SectionLoader> => vi.fn<SectionLoader>(() => Promise.resolve({ default: () => null }));

const createLoaders = (): MockSectionLoadersValue => ({
  catalog: createLoader(),
  deals: createLoader(),
  network: createLoader(),
  warehouse: createLoader(),
});

const createRoot = (): Root => ({ render: vi.fn(), unmount: vi.fn() });

const mountAt = async (path: string, sectionLoaders: MockSectionLoadersValue): Promise<void> => {
  await mountApp({
    installPromptSource: createInstallPromptSource(window),
    localizer: await createTestLocalizer(),
    locationSource: createMemoryLocation(path),
    root: createRoot(),
    sectionLoaders,
    themeStore: createTestThemeStore(),
  });
};

describe('mountApp', () => {
  beforeEach(() => {
    vi.mocked(createApiRuntime).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('starts loading the section of the address before the engine runtime is ready', async () => {
    const loaders = createLoaders();
    let loadersCalledWhenRuntimeRequested: number | undefined;

    vi.mocked(createApiRuntime).mockImplementation(() => {
      loadersCalledWhenRuntimeRequested = loaders.deals.mock.calls.length;

      return Promise.reject(START_FAILURE);
    });

    await expect(mountAt('/deals', loaders)).rejects.toBe(START_FAILURE);

    expect(loadersCalledWhenRuntimeRequested).toBe(1);
    expect(loaders.network.mock.calls).toHaveLength(0);
  });

  it('starts loading the first section for an address without a section', async () => {
    const loaders = createLoaders();

    vi.mocked(createApiRuntime).mockRejectedValue(START_FAILURE);

    await expect(mountAt('/', loaders)).rejects.toBe(START_FAILURE);

    expect(loaders.network.mock.calls).toHaveLength(1);
  });

  it('keeps starting when the section chunk fails to load', async () => {
    const loaders = createLoaders();
    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const loadError = new Error('Failed to fetch dynamically imported module');

    loaders.network.mockRejectedValue(loadError);
    vi.mocked(createApiRuntime).mockRejectedValue(START_FAILURE);

    await expect(mountAt('/network', loaders)).rejects.toBe(START_FAILURE);
    await vi.waitFor(() => {
      expect(logError).toHaveBeenCalledWith('> mountApp -> prewarmStartSection:', { error: loadError, section: 'network' });
    });
    expect(vi.mocked(createApiRuntime)).toHaveBeenCalledOnce();
  });
});
