import type { ReactElement } from 'react';
import type { Mock } from 'vitest';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ILocalizer } from '@/shared/i18n';
import type { AppSectionValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import {
  APP_SECTIONS,
  OBJECT_HOME_SECTION,
  OBJECT_TYPES,
  RoutingProvider,
} from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import type {
  SectionLoader,
  SectionPageProps,
} from './sectionPages';

import { AppRoutes } from './AppRoutes';

type StubLoadersValue = Record<AppSectionValue, Mock<SectionLoader>>;

const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';
const OTHER_OBJECT_ID = 'f6000002-0000-4000-8000-000000000000';
const CHUNK_ERROR = new Error('chunk is unavailable');

const createStubPage = (section: AppSectionValue): (props: SectionPageProps) => ReactElement => {
  const StubPage = ({ focus }: SectionPageProps): ReactElement => (
    <p data-testid={`page-${section}`}>{focus === undefined ? '' : `${focus.type}:${focus.id}`}</p>
  );

  return StubPage;
};

const createStubLoader = (section: AppSectionValue): SectionLoader => () => Promise.resolve({ default: createStubPage(section) });

const createStubLoaders = (): StubLoadersValue => ({
  catalog: vi.fn(createStubLoader('catalog')),
  deals: vi.fn(createStubLoader('deals')),
  network: vi.fn(createStubLoader('network')),
  warehouse: vi.fn(createStubLoader('warehouse')),
});

const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

interface RenderedRoutesValue {
  loaders: StubLoadersValue;
  location: IMemoryLocation;
}

const renderRoutes = async (initialPath: string, loaders: StubLoadersValue = createStubLoaders()): Promise<RenderedRoutesValue> => {
  const localizer = await createTestLocalizer();
  const location = createMemoryLocation(initialPath);

  render(
    <StrictMode>
      <RoutingProvider location={location}>
        <LocalizerProvider localizer={localizer}>
          <AppRoutes sectionLoaders={loaders} />
        </LocalizerProvider>
      </RoutingProvider>
    </StrictMode>,
  );

  return { loaders, location };
};

const createDeferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const getLoggedLabels = (spy: { mock: { calls: unknown[][] } }): unknown[] => spy.mock.calls.map(([label]) => label);

const stubIdleCallbacks = (): { cancel: Mock<(handle: number) => void>; runIdle: () => void } => {
  const callbacks = new Map<number, () => void>();
  let lastHandle = 0;
  const cancel = vi.fn<(handle: number) => void>((handle) => {
    callbacks.delete(handle);
  });

  vi.stubGlobal('requestIdleCallback', (callback: () => void): number => {
    lastHandle += 1;
    callbacks.set(lastHandle, callback);

    return lastHandle;
  });
  vi.stubGlobal('cancelIdleCallback', cancel);

  return {
    cancel,
    runIdle: () => {
      const pending = [...callbacks.values()];

      callbacks.clear();
      for (const callback of pending) {
        callback();
      }
    },
  };
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AppRoutes sections', () => {
  it.each(APP_SECTIONS)('shows the page of the section %s without an object', async (section) => {
    await renderRoutes(`/${section}`);

    const page = await screen.findByTestId(`page-${section}`);

    expect(page.textContent).toBe('');
    expect(APP_SECTIONS.filter(other => screen.queryByTestId(`page-${other}`) !== null)).toEqual([section]);
  });

  it.each(OBJECT_TYPES)('opens the object of the type %s in the page of its home section with the object', async (type) => {
    const segments = {
      cell: 'cells',
      dashboard: 'dashboards',
      deal: 'deals',
      document: 'documents',
      handling_unit: 'handling-units',
      trip: 'trips',
      vehicle: 'vehicles',
      warehouse: 'warehouses',
    } as const;
    const section = OBJECT_HOME_SECTION[type];

    await renderRoutes(`/${segments[type]}/${OBJECT_ID}`);

    const page = await screen.findByTestId(`page-${section}`);

    expect(page.textContent).toBe(`${type}:${OBJECT_ID}`);
    expect(APP_SECTIONS.filter(other => screen.queryByTestId(`page-${other}`) !== null)).toEqual([section]);
  });

  it('shows one main landmark that holds the page', async () => {
    await renderRoutes('/catalog');

    const page = await screen.findByTestId('page-catalog');

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main').contains(page)).toBe(true);
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBeNull();
  });

  it('moves to the page of another section and to another object of the same section', async () => {
    const { location } = await renderRoutes('/deals');
    await screen.findByTestId('page-deals');

    act(() => {
      location.navigate(`/deals/${OBJECT_ID}`);
    });

    expect((await screen.findByTestId('page-deals')).textContent).toBe(`deal:${OBJECT_ID}`);

    act(() => {
      location.navigate(`/deals/${OTHER_OBJECT_ID}`);
    });

    await waitFor(() => {
      expect(screen.getByTestId('page-deals').textContent).toBe(`deal:${OTHER_OBJECT_ID}`);
    });

    act(() => {
      location.navigate('/network');
    });

    expect(await screen.findByTestId('page-network')).toBeDefined();
    expect(screen.queryByTestId('page-deals')).toBeNull();
  });
});

describe('AppRoutes empty address', () => {
  it('replaces the empty address with the first section and leaves no entry for it in the history', async () => {
    const { location } = await renderRoutes('/');

    expect(await screen.findByTestId('page-network')).toBeDefined();
    expect(location.history).toEqual(['/network']);

    act(() => {
      location.back();
    });

    expect(location.currentIndex).toBe(0);
    expect(location.read().path).toBe('/network');
    expect(screen.getByTestId('page-network')).toBeDefined();
  });

  it('keeps the earlier entries of the history when it replaces the empty address', async () => {
    const { location } = await renderRoutes('/catalog');
    await screen.findByTestId('page-catalog');

    act(() => {
      location.navigate('/');
    });

    expect(await screen.findByTestId('page-network')).toBeDefined();
    expect(location.history).toEqual(['/catalog', '/network']);

    act(() => {
      location.back();
    });

    expect(await screen.findByTestId('page-catalog')).toBeDefined();
  });
});

describe('AppRoutes unknown address', () => {
  it('shows the not found screen with a link to the first section', async () => {
    await renderRoutes('/nope');

    expect(screen.getByRole('heading', { level: 1, name: defaultLocaleCatalog['routing.notFound.title'] })).toBeDefined();

    const link = screen.getByRole('link', {
      name: defaultLocaleCatalog['routing.notFound.action'].replace('{section}', defaultLocaleCatalog['section.network.title']),
    });

    expect(link.getAttribute('href')).toBe('#/network');
    expect(APP_SECTIONS.filter(section => screen.queryByTestId(`page-${section}`) !== null)).toEqual([]);
  });

  it.each([
    `/deals/${OBJECT_ID}/extra`,
    '/Deals',
    '/deals/a%20b',
    `/unknown/${OBJECT_ID}`,
  ])('treats %s as an unknown address', async (path) => {
    await renderRoutes(path);

    expect(screen.getByRole('heading', { level: 1, name: defaultLocaleCatalog['routing.notFound.title'] })).toBeDefined();
  });

  it('accepts the trailing slash of a section', async () => {
    await renderRoutes('/deals/');

    expect(await screen.findByTestId('page-deals')).toBeDefined();
  });

  it('opens the first section by the link and adds an entry to the history', async () => {
    const { location } = await renderRoutes('/nope');

    fireEvent.click(screen.getByRole('link'));

    expect(await screen.findByTestId('page-network')).toBeDefined();
    expect(location.history).toEqual(['/nope', '/network']);
    expect(screen.queryByRole('heading', { name: defaultLocaleCatalog['routing.notFound.title'] })).toBeNull();
  });
});

describe('AppRoutes loading', () => {
  it('shows an empty busy landmark until the chunk of the page is loaded', async () => {
    const loaders = createStubLoaders();
    const chunk = createDeferred();
    loaders.deals.mockImplementation(async () => {
      await chunk.promise;

      return { default: createStubPage('deals') };
    });

    await renderRoutes('/deals', loaders);

    const waiting = screen.getByRole('main', { busy: true });

    expect(waiting.textContent).toBe('');
    expect(screen.queryByTestId('page-deals')).toBeNull();

    chunk.resolve();

    expect(await screen.findByTestId('page-deals')).toBeDefined();
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBeNull();
  });

  it('does not load the chunk of a section that is not opened', async () => {
    stubIdleCallbacks();
    const { loaders } = await renderRoutes('/catalog');
    await screen.findByTestId('page-catalog');

    expect(loaders.catalog).toHaveBeenCalledOnce();
    expect(loaders.deals).not.toHaveBeenCalled();
    expect(loaders.network).not.toHaveBeenCalled();
    expect(loaders.warehouse).not.toHaveBeenCalled();
  });
});

describe('AppRoutes preload', () => {
  it('loads the chunks of the other sections when the browser is idle and not before', async () => {
    const idle = stubIdleCallbacks();
    const { loaders } = await renderRoutes('/deals');
    await screen.findByTestId('page-deals');

    expect(loaders.network).not.toHaveBeenCalled();

    idle.runIdle();

    expect(loaders.network).toHaveBeenCalledOnce();
    expect(loaders.catalog).toHaveBeenCalledOnce();
    expect(loaders.warehouse).toHaveBeenCalledOnce();
    expect(loaders.deals).toHaveBeenCalledOnce();
  });

  it('shows the page of a preloaded section at once without waiting', async () => {
    const idle = stubIdleCallbacks();
    const { loaders, location } = await renderRoutes('/network');
    await screen.findByTestId('page-network');
    idle.runIdle();
    await act(async () => {
      await vi.waitFor(() => {
        expect(loaders.deals.mock.settledResults.map(result => result.type)).toEqual(['fulfilled']);
      });
    });

    act(() => {
      location.navigate('/deals');
    });

    expect(screen.getByTestId('page-deals')).toBeDefined();
    expect(screen.queryByTestId('page-network')).toBeNull();
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBeNull();
    expect(loaders.deals).toHaveBeenCalledOnce();
  });

  it('loads every section after an unknown address', async () => {
    const idle = stubIdleCallbacks();
    const { loaders } = await renderRoutes('/nope');

    idle.runIdle();

    for (const section of APP_SECTIONS) {
      expect(loaders[section]).toHaveBeenCalledOnce();
    }
  });

  it('does not preload again after the navigation', async () => {
    const idle = stubIdleCallbacks();
    const { loaders, location } = await renderRoutes('/network');
    await screen.findByTestId('page-network');
    idle.runIdle();

    act(() => {
      location.navigate('/catalog');
    });
    await screen.findByTestId('page-catalog');
    idle.runIdle();

    expect(loaders.warehouse).toHaveBeenCalledOnce();
    expect(loaders.deals).toHaveBeenCalledOnce();
  });

  it('cancels the pending preload when the routes disappear', async () => {
    const idle = stubIdleCallbacks();
    const { loaders } = await renderRoutes('/network');
    await screen.findByTestId('page-network');

    cleanup();

    expect(idle.cancel).toHaveBeenCalled();
    idle.runIdle();
    expect(loaders.deals).not.toHaveBeenCalled();
  });

  it('keeps the page and reports to the console when a preload fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const idle = stubIdleCallbacks();
    const loaders = createStubLoaders();
    loaders.warehouse.mockRejectedValue(CHUNK_ERROR);
    await renderRoutes('/network', loaders);
    await screen.findByTestId('page-network');

    idle.runIdle();

    await waitFor(() => {
      expect(getLoggedLabels(consoleError)).toContain('> SectionPreloader -> preloadOtherSections:');
    });
    expect(screen.getByTestId('page-network')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('falls back to a timer where the browser has no idle callback', async () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    try {
      const { loaders } = await renderRoutes('/network');
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(loaders.deals).toHaveBeenCalledOnce();
      expect(loaders.catalog).toHaveBeenCalledOnce();
      expect(loaders.warehouse).toHaveBeenCalledOnce();
    }
    finally {
      vi.useRealTimers();
    }
  });
});

describe('AppRoutes chunk failure', () => {
  const renderFailingDeals = async (initialPath = '/deals'): Promise<RenderedRoutesValue> => {
    const loaders = createStubLoaders();
    loaders.deals.mockRejectedValue(CHUNK_ERROR);

    return renderRoutes(initialPath, loaders);
  };

  it('shows the error screen instead of a blank page and reports the error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderFailingDeals();

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe(defaultLocaleCatalog['routing.chunkError.message']);
    expect(screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] })).toBeDefined();
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBeNull();
    expect(getLoggedLabels(consoleError)).toContain('> SectionErrorBoundary -> componentDidCatch:');
  });

  it('reloads the page on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { location } = await renderFailingDeals();

    fireEvent.click(await screen.findByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    expect(location.reloadCount).toBe(1);
  });

  it('shows the error screen for an object of the failing section', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderFailingDeals(`/deals/${OBJECT_ID}`);

    expect(await screen.findByRole('alert')).toBeDefined();
  });

  it('leaves the error screen when the user opens another section', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { location } = await renderFailingDeals();
    await screen.findByRole('alert');

    act(() => {
      location.navigate('/network');
    });

    expect(await screen.findByTestId('page-network')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('AppRoutes focus', () => {
  it('does not move the focus when the first page appears', async () => {
    await renderRoutes('/network');
    await screen.findByTestId('page-network');

    expect(document.activeElement).not.toBe(screen.getByRole('main'));
  });

  it('does not move the focus when the empty address becomes the first section', async () => {
    await renderRoutes('/');
    await screen.findByTestId('page-network');

    expect(document.activeElement).not.toBe(screen.getByRole('main'));
  });

  it('makes the landmark focusable by code only', async () => {
    await renderRoutes('/network');

    expect(screen.getByRole('main').getAttribute('tabindex')).toBe('-1');
  });

  it('moves the focus to the main landmark when the address changes', async () => {
    const { location } = await renderRoutes('/network');
    await screen.findByTestId('page-network');

    act(() => {
      location.navigate('/catalog');
    });
    await screen.findByTestId('page-catalog');

    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('moves the focus when only the object changes inside one section', async () => {
    const { location } = await renderRoutes(`/deals/${OBJECT_ID}`);
    await screen.findByTestId('page-deals');
    expect(document.activeElement).not.toBe(screen.getByRole('main'));

    act(() => {
      location.navigate(`/deals/${OTHER_OBJECT_ID}`);
    });

    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('moves the focus to the main landmark on the not found screen after the navigation', async () => {
    const { location } = await renderRoutes('/network');
    await screen.findByTestId('page-network');

    act(() => {
      location.navigate('/nope');
    });

    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('keeps the focus where it is when the same address is opened again', async () => {
    const { location } = await renderRoutes('/network');
    await screen.findByTestId('page-network');

    act(() => {
      location.navigate('/network', { isReplace: true });
    });

    expect(document.activeElement).not.toBe(screen.getByRole('main'));
  });
});
