import type { ReactElement } from 'react';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IDemoControl } from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';
import type { AppSectionValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import {
  APP_SECTIONS,
  OBJECT_HOME_SECTION,
  OBJECT_TYPES,
} from '@/shared/routing';
import { SKELETON_DELAY_MS } from '@/shared/ui';

import type { AvailableSectionsValue } from '../access';

import { SECTION_TITLE_KEYS } from '../routing/sections';

type LoadPersonaSwitcherType = typeof import('./loadPersonaSwitcher').loadPersonaSwitcher;

vi.mock('./loadPersonaSwitcher', () => ({ loadPersonaSwitcher: vi.fn() }));

const BRAND_NAME = 'Северный склад';
const ALL_SECTIONS_VALUE: AvailableSectionsValue = { kind: 'ready', landingSection: 'network', sections: APP_SECTIONS };
const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';
const OBJECT_SEGMENTS = {
  cell: 'cells',
  dashboard: 'dashboards',
  deal: 'deals',
  document: 'documents',
  handling_unit: 'handling-units',
  trip: 'trips',
  vehicle: 'vehicles',
  warehouse: 'warehouses',
} as const;

interface GateValue {
  open: () => void;
  promise: Promise<void>;
}

interface RenderedTopBarValue {
  loadPersonaSwitcher: LoadPersonaSwitcherType;
  location: IMemoryLocation;
  remountTopBar: () => void;
}

interface RenderTopBarOptionsValue {
  availableSections?: AvailableSectionsValue;
  demoControl?: IDemoControl;
  rejectedLoadCount?: number;
  switcherGate?: GateValue;
}

const createGate = (): GateValue => {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { open, promise };
};

const renderTopBar = async (
  initialPath: string,
  { availableSections = ALL_SECTIONS_VALUE, demoControl, rejectedLoadCount = 0, switcherGate }: RenderTopBarOptionsValue = {},
): Promise<RenderedTopBarValue> => {
  vi.resetModules();

  const [
    { ApiRuntimeProvider },
    { createTestRuntime },
    { createLocalizer, LocalizerProvider },
    { RoutingProvider },
    { createMemoryLocation },
    { TenantSettingsProvider },
    { AvailableSectionsProvider },
    { loadPersonaSwitcher: mockedLoadPersonaSwitcher },
    { TopBar },
  ] = await Promise.all([
    import('@/shared/api'),
    import('@/shared/api/index.testing'),
    import('@/shared/i18n'),
    import('@/shared/routing'),
    import('@/shared/routing/index.testing'),
    import('@/shared/tenant'),
    import('../access'),
    import('./loadPersonaSwitcher'),
    import('./TopBar'),
  ]);

  const actualModule = await vi.importActual<typeof import('./loadPersonaSwitcher')>('./loadPersonaSwitcher');
  const loadActualPersonaSwitcher: LoadPersonaSwitcherType = switcherGate === undefined
    ? actualModule.loadPersonaSwitcher
    : () => switcherGate.promise.then(actualModule.loadPersonaSwitcher);

  let rejectedCount = 0;
  const loadWithRejections: LoadPersonaSwitcherType = () => {
    if (rejectedCount < rejectedLoadCount) {
      rejectedCount += 1;

      return Promise.reject(new Error('the persona switcher chunk is unavailable'));
    }

    return loadActualPersonaSwitcher();
  };

  vi.mocked(mockedLoadPersonaSwitcher).mockReset();
  vi.mocked(mockedLoadPersonaSwitcher).mockImplementation(loadWithRejections);

  const localizer: ILocalizer = await createLocalizer({
    bundledLocales: ['ru'],
    catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
    userTimeZone: 'UTC',
  });
  const location = createMemoryLocation(initialPath);
  const runtime = createTestRuntime({ demoControl });

  const queryClient = new QueryClient();
  const tenantSettings = {
    availableLocales: ['ru'],
    brandName: BRAND_NAME,
    defaultLocale: 'ru',
    tenantId: 'f2000001-0000-4000-8000-000000000000',
    termOverrides: {},
  };
  const createTree = (topBarKey: number): ReactElement => (
    <RoutingProvider location={location}>
      <LocalizerProvider localizer={localizer}>
        <ApiRuntimeProvider runtime={runtime}>
          <QueryClientProvider client={queryClient}>
            <TenantSettingsProvider tenantSettings={tenantSettings}>
              <AvailableSectionsProvider value={availableSections}>
                <TopBar key={topBarKey} />
              </AvailableSectionsProvider>
            </TenantSettingsProvider>
          </QueryClientProvider>
        </ApiRuntimeProvider>
      </LocalizerProvider>
    </RoutingProvider>
  );

  let topBarKey = 0;
  const { rerender } = render(createTree(topBarKey));

  const remountTopBar = (): void => {
    topBarKey += 1;
    rerender(createTree(topBarKey));
  };

  return { loadPersonaSwitcher: mockedLoadPersonaSwitcher, location, remountTopBar };
};

const createDemoControl = (): IDemoControl => ({
  listPersonas: () => Promise.resolve([]),
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset: () => Promise.resolve(),
});

const getSectionTitle = (section: AppSectionValue): string => defaultLocaleCatalog[SECTION_TITLE_KEYS[section]];

const getNavigation = (): HTMLElement => screen.getByRole('navigation', { name: defaultLocaleCatalog['app.nav.label'] });

const getCurrentSections = (): AppSectionValue[] => {
  return APP_SECTIONS.filter((section) => {
    return within(getNavigation()).getByRole('link', { name: getSectionTitle(section) }).getAttribute('aria-current') === 'page';
  });
};

describe('TopBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the brand of the organization without translation', async () => {
    await renderTopBar('/network');

    const brand = screen.getByText(BRAND_NAME);

    expect(brand.getAttribute('translate')).toBe('no');
  });

  it('has a labelled navigation with a link to every section in order', async () => {
    await renderTopBar('/network');

    const links = within(getNavigation()).getAllByRole('link');

    expect(links.map(link => link.textContent)).toEqual(APP_SECTIONS.map(getSectionTitle));
    expect(links.map(link => link.getAttribute('href'))).toEqual(APP_SECTIONS.map(section => `#/${section}`));
  });

  it.each(APP_SECTIONS)('marks only the section %s as the current page', async (section) => {
    await renderTopBar(`/${section}`);

    expect(getCurrentSections()).toEqual([section]);
  });

  it.each(OBJECT_TYPES)('marks the home section of the object type %s as the current page', async (type) => {
    await renderTopBar(`/${OBJECT_SEGMENTS[type]}/${OBJECT_ID}`);

    expect(getCurrentSections()).toEqual([OBJECT_HOME_SECTION[type]]);
  });

  it.each(['/', '/nope'])('marks no section for the address %s', async (path) => {
    await renderTopBar(path);

    expect(getCurrentSections()).toEqual([]);
  });

  it('opens the section by the link and moves the current mark', async () => {
    const { location } = await renderTopBar('/network');

    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('deals') }));

    expect(location.history).toEqual(['/network', '/deals']);
    expect(getCurrentSections()).toEqual(['deals']);
  });

  it('follows the history', async () => {
    const { location } = await renderTopBar('/network');
    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('catalog') }));

    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('warehouse') }));
    act(() => {
      location.back();
    });

    expect(getCurrentSections()).toEqual(['catalog']);
  });

  it('leaves the modified click to the browser', async () => {
    const { location } = await renderTopBar('/network');

    fireEvent.click(within(getNavigation()).getByRole('link', { name: getSectionTitle('deals') }), { ctrlKey: true });

    expect(location.history).toEqual(['/network']);
    expect(getCurrentSections()).toEqual(['network']);
  });

  it('shows only the sections that are available, in the order of sections', async () => {
    const sections: AppSectionValue[] = ['network', 'deals', 'warehouse'];
    await renderTopBar('/warehouse', { availableSections: { kind: 'ready', landingSection: 'network', sections } });

    const links = within(getNavigation()).getAllByRole('link');

    expect(links.map(link => link.textContent)).toEqual(sections.map(getSectionTitle));
    expect(within(getNavigation()).queryByRole('link', { name: getSectionTitle('catalog') })).toBeNull();
  });

  it('shows the single section of a persona that has one', async () => {
    await renderTopBar('/warehouse', {
      availableSections: { kind: 'ready', landingSection: 'warehouse', sections: ['warehouse'] },
    });

    expect(within(getNavigation()).getAllByRole('link').map(link => link.textContent)).toEqual([getSectionTitle('warehouse')]);
  });

  const UNREADY_VALUES: AvailableSectionsValue[] = [
    { kind: 'loading' },
    { kind: 'empty' },
    { error: new Error('the session is unavailable'), isRetrying: false, kind: 'error', onRetry: () => undefined },
  ];

  it.each(UNREADY_VALUES)('keeps the brand and an empty navigation while the sections are $kind', async (availableSections) => {
    await renderTopBar('/network', { availableSections });

    expect(screen.getByText(BRAND_NAME)).toBeDefined();
    expect(within(getNavigation()).queryAllByRole('link')).toEqual([]);
  });

  it('loads no persona switcher chunk and renders no placeholder outside the demo', async () => {
    const { loadPersonaSwitcher } = await renderTopBar('/network');

    expect(loadPersonaSwitcher).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('status', { name: defaultLocaleCatalog['persona.loading'] })).toBeNull();
    expect(screen.getByRole('banner').querySelector('[aria-hidden]')).toBeNull();
  });

  it('keeps a labelled placeholder of the trigger size in the banner until the switcher chunk is loaded', async () => {
    const gate = createGate();
    const { loadPersonaSwitcher } = await renderTopBar('/network', { demoControl: createDemoControl(), switcherGate: gate });

    const group = screen.getByRole('status', { name: defaultLocaleCatalog['persona.loading'] });
    const placeholder = group.querySelector('[aria-hidden]');

    expect(screen.getByRole('banner').contains(group)).toBe(true);
    expect(group.getAttribute('aria-busy')).toBe('true');
    expect(placeholder?.className).toContain('bg-transparent');
    expect(placeholder?.className).not.toContain('bg-skeleton');
    expect(placeholder?.className).toContain('h-11');
    expect(placeholder?.className).toContain('w-80');
    expect(screen.queryByRole('button')).toBeNull();

    gate.open();

    await screen.findByRole('button', { name: defaultLocaleCatalog['persona.label'] });

    expect(loadPersonaSwitcher).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status', { name: defaultLocaleCatalog['persona.loading'] })).toBeNull();
    expect(screen.getByRole('banner').querySelector('[aria-hidden="true"].h-11')).toBeNull();
  });

  it('fills the placeholder when the switcher chunk is slow', async () => {
    const gate = createGate();
    await renderTopBar('/network', { demoControl: createDemoControl(), switcherGate: gate });

    const placeholder = screen.getByRole('status', { name: defaultLocaleCatalog['persona.loading'] }).querySelector('[aria-hidden]');

    await waitFor(() => {
      expect(placeholder?.className).toContain('bg-skeleton');
    }, { timeout: SKELETON_DELAY_MS * 8 });

    gate.open();

    await screen.findByRole('button', { name: defaultLocaleCatalog['persona.label'] });

    expect(screen.queryByRole('status', { name: defaultLocaleCatalog['persona.loading'] })).toBeNull();
  });

  it('shows the persona switcher in the banner of the demo while the sections load', async () => {
    await renderTopBar('/network', { availableSections: { kind: 'loading' }, demoControl: createDemoControl() });

    const switcher = await screen.findByRole('button', { name: defaultLocaleCatalog['persona.label'] });

    expect(screen.getByRole('banner').contains(switcher)).toBe(true);
    expect(switcher.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('keeps the loaded switcher on the screen when the acting context changes and the top bar is mounted again', async () => {
    const { loadPersonaSwitcher, remountTopBar } = await renderTopBar('/network', { demoControl: createDemoControl() });
    const trigger = await screen.findByRole('button', { name: defaultLocaleCatalog['persona.label'] });

    act(() => {
      remountTopBar();
    });

    expect(screen.getByRole('button', { name: defaultLocaleCatalog['persona.label'] })).not.toBe(trigger);
    expect(screen.queryByRole('status', { name: defaultLocaleCatalog['persona.loading'] })).toBeNull();
    expect(loadPersonaSwitcher).toHaveBeenCalledTimes(1);
  });

  describe('when the persona switcher chunk fails to load', () => {
    const RETRY_NAME = defaultLocaleCatalog['persona.loadError.retry'];

    const renderWithRejections = async (rejectedLoadCount: number): Promise<RenderedTopBarValue> => {
      return renderTopBar('/network', { demoControl: createDemoControl(), rejectedLoadCount });
    };

    it('keeps the brand, navigation and a retry button instead of crashing the shell', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      try {
        const { loadPersonaSwitcher } = await renderWithRejections(1);

        const retryButton = await screen.findByRole('button', { name: RETRY_NAME });

        expect(screen.getByRole('banner').contains(retryButton)).toBe(true);
        expect(retryButton.className).toContain('w-80');
        expect(screen.getByText(BRAND_NAME)).toBeDefined();
        expect(within(getNavigation()).getAllByRole('link').map(link => link.textContent)).toEqual(APP_SECTIONS.map(getSectionTitle));
        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.queryByRole('status', { name: defaultLocaleCatalog['persona.loading'] })).toBeNull();
        expect(loadPersonaSwitcher).toHaveBeenCalledTimes(1);
        const isLoadErrorReported = consoleErrorSpy.mock.calls.some(call => call[0] === '> SectionErrorBoundary -> componentDidCatch:');

        expect(isLoadErrorReported).toBe(true);
      }
      finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('loads the switcher again by the retry button', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      try {
        const { loadPersonaSwitcher } = await renderWithRejections(1);

        fireEvent.click(await screen.findByRole('button', { name: RETRY_NAME }));

        const trigger = await screen.findByRole('button', { name: defaultLocaleCatalog['persona.label'] });

        expect(screen.getByRole('banner').contains(trigger)).toBe(true);
        expect(trigger.className).toContain('w-80');
        expect(screen.queryByRole('button', { name: RETRY_NAME })).toBeNull();
        expect(loadPersonaSwitcher).toHaveBeenCalledTimes(2);
      }
      finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('offers the retry again when the next load fails too', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      try {
        const { loadPersonaSwitcher } = await renderWithRejections(2);

        fireEvent.click(await screen.findByRole('button', { name: RETRY_NAME }));

        await waitFor(() => {
          expect(loadPersonaSwitcher).toHaveBeenCalledTimes(2);
        });
        fireEvent.click(await screen.findByRole('button', { name: RETRY_NAME }));

        await screen.findByRole('button', { name: defaultLocaleCatalog['persona.label'] });

        expect(loadPersonaSwitcher).toHaveBeenCalledTimes(3);
      }
      finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });
});
