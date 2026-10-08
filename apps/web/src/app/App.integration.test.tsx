import {
  createInProcessEngineConnection,
  SeedOrganizationId,
  SeedPersonaId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { StrictMode } from 'react';
import {
  bundledLocales,
  catalogLoaders,
  defaultLocaleCatalog,
  defaultTenant,
} from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  ActingContextValue,
  ApiRuntimeValue,
  IFrameScheduler,
} from '@/shared/api';
import type { AppSectionValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import {
  createApiRuntime,
  createIdempotencyKey,
  createQueryClient,
  syncQueriesWithRealtime,
} from '@/shared/api';
import { createLocalizer } from '@/shared/i18n';
import { APP_SECTIONS } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { App } from './App';
import { createTestThemeStore } from './lib/testing/themeFixtures';
import { SECTION_TITLE_KEYS } from './routing/sections';

const BRAND_NAME = 'Покупатель 1';
const SEED_WAREHOUSE_COUNT = 3;
const LIST_WAREHOUSES_PATH = '/ListWarehouses';

interface HarnessValue {
  frames: ManualFramesValue;
  getBusyPlaceholderCount: () => number;
  getListWarehousesCallCount: () => number;
  location: IMemoryLocation;
  runtime: ApiRuntimeValue;
}

interface ManualFramesValue {
  flushFrame: () => void;
  isPending: () => boolean;
  scheduler: IFrameScheduler;
}

interface StartApplicationOptionsValue {
  initialPath?: string;
  preferredContext?: ActingContextValue;
}

const closers: (() => Promise<void>)[] = [];

const createManualFrames = (): ManualFramesValue => {
  let pending: (() => void) | undefined;

  return {
    flushFrame: () => {
      const flush = pending;

      pending = undefined;
      flush?.();
    },
    isPending: () => pending !== undefined,
    scheduler: {
      schedule: (flush) => {
        pending = flush;

        return () => {
          if (pending === flush) {
            pending = undefined;
          }
        };
      },
    },
  };
};

const getRequestUrl = (input: Parameters<typeof fetch>[0]): string => {
  if (input instanceof Request) {
    return input.url;
  }

  return input instanceof URL ? input.href : input;
};

const BUSY_PLACEHOLDER_SELECTOR = '[aria-busy="true"]:not(button)';

const hasBusyPlaceholder = (node: Node): boolean => {
  return node instanceof Element
    && (node.matches(BUSY_PLACEHOLDER_SELECTOR) || node.querySelector(BUSY_PLACEHOLDER_SELECTOR) !== null);
};

interface BusyPlaceholderWatchValue {
  getBusyPlaceholderCount: () => number;
  stop: () => void;
}

const watchBusyPlaceholders = (): BusyPlaceholderWatchValue => {
  let busyPlaceholderCount = 0;

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      busyPlaceholderCount += [...record.addedNodes].filter(hasBusyPlaceholder).length;

      if (record.type === 'attributes' && hasBusyPlaceholder(record.target)) {
        busyPlaceholderCount += 1;
      }
    }
  });

  observer.observe(document.body, {
    attributeFilter: ['aria-busy'],
    attributes: true,
    childList: true,
    subtree: true,
  });

  const stop = (): void => {
    observer.disconnect();
  };

  return { getBusyPlaceholderCount: () => busyPlaceholderCount, stop };
};

const startApplication = async ({
  initialPath = '/warehouse',
  preferredContext,
}: StartApplicationOptionsValue = {}): Promise<HarnessValue> => {
  const inProcess = createInProcessEngineConnection();
  const frames = createManualFrames();
  let listWarehousesCallCount = 0;
  let notifySubscribed = (): void => undefined;
  const subscribed = new Promise<void>((resolve) => {
    notifySubscribed = resolve;
  });

  const runtime = await createApiRuntime({
    connection: {
      ...inProcess.connection,
      fetch: (input, init) => {
        if (getRequestUrl(input).endsWith(LIST_WAREHOUSES_PATH)) {
          listWarehousesCallCount += 1;
        }

        return inProcess.connection.fetch(input, init);
      },
      subscribe: (channel, headers, handlers) => inProcess.connection.subscribe(channel, headers, {
        ...handlers,
        onSubscribed: (position) => {
          handlers.onSubscribed(position);
          notifySubscribed();
        },
      }),
    },
    defaultOrganizationId: defaultTenant.tenantId,
    frameScheduler: frames.scheduler,
    preferredContext,
  });
  const localizer = await createLocalizer({
    bundledLocales,
    catalogLoaders,
    requestedLocale: undefined,
    tenant: defaultTenant,
    userTimeZone: 'UTC',
  });
  const queryClient = createQueryClient({ networkMode: runtime.networkMode });
  const stopSync = syncQueriesWithRealtime({
    demoControl: runtime.demoControl,
    queryClient,
    realtime: runtime.realtime,
  });

  const location = createMemoryLocation(initialPath);

  render(
    <StrictMode>
      <App
        localizer={localizer}
        location={location}
        queryClient={queryClient}
        runtime={runtime}
        themeStore={createTestThemeStore()}
      />
    </StrictMode>,
  );

  closers.push(async () => {
    stopSync();
    runtime.close();
    await inProcess.close();
  });

  await screen.findByRole('heading', { level: 1 });
  await subscribed;
  const busyPlaceholderWatch = watchBusyPlaceholders();

  closers.push(() => {
    busyPlaceholderWatch.stop();

    return Promise.resolve();
  });

  return {
    frames,
    getBusyPlaceholderCount: busyPlaceholderWatch.getBusyPlaceholderCount,
    getListWarehousesCallCount: () => listWarehousesCallCount,
    location,
    runtime,
  };
};

const getBrand = (): HTMLElement => within(screen.getByRole('banner')).getByText(BRAND_NAME);

const getWarehouseItems = (): HTMLElement[] => {
  const section = screen.getByRole('region', { name: defaultLocaleCatalog['warehouse.warehouses.title'] });

  return within(section).queryAllByRole('listitem');
};

const expectWarehouseCount = async (frames: ManualFramesValue, count: number): Promise<void> => {
  await waitFor(() => {
    frames.flushFrame();
    expect(getWarehouseItems()).toHaveLength(count);
  });
};

const createWarehouse = async (runtime: ApiRuntimeValue): Promise<void> => {
  const { warehouses } = await runtime.client.organization.listWarehouses({});
  const [template] = warehouses;

  await runtime.client.organization.createWarehouse({
    address: 'ул. Вымышленная, 1',
    boardNodeId: template?.boardNodeId ?? '',
    capabilities: [],
    cityId: template?.cityId ?? '',
    idempotencyKey: createIdempotencyKey(),
    name: 'Склад для события',
    timeZone: 'Europe/Moscow',
  });
};

afterEach(async () => {
  cleanup();

  for (const close of closers.splice(0).reverse()) {
    await close();
  }
});

describe('App with the demo engine in the same thread', () => {
  it('shows the organization of the profile with its warehouses and synchronizes the document', async () => {
    await startApplication();

    const brand = getBrand();

    expect(brand.getAttribute('translate')).toBe('no');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(defaultLocaleCatalog['section.warehouse.title']);
    expect(await screen.findByRole('region', { name: defaultLocaleCatalog['warehouse.organization.title'] })).toBeDefined();
    await waitFor(() => {
      expect(getWarehouseItems()).toHaveLength(SEED_WAREHOUSE_COUNT);
    });
    expect(getWarehouseItems().map(item => item.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Склад 1')]),
    );
    expect(document.title).toBe(
      defaultLocaleCatalog['app.documentTitle']
        .replace('{section}', defaultLocaleCatalog['section.warehouse.title'])
        .replace('{brand}', BRAND_NAME),
    );
    expect(document.documentElement.lang).toBe('ru');
  });

  it('refetches the warehouses once after the engine announces a new warehouse', async () => {
    const { frames, getBusyPlaceholderCount, getListWarehousesCallCount, runtime } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    await waitFor(() => {
      expect(frames.isPending()).toBe(false);
    });
    await createWarehouse(runtime);
    const callCountAfterCreation = getListWarehousesCallCount();
    await vi.waitFor(() => {
      expect(frames.isPending()).toBe(true);
    });

    expect(getWarehouseItems()).toHaveLength(SEED_WAREHOUSE_COUNT);

    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT + 1);

    expect(getListWarehousesCallCount() - callCountAfterCreation).toBe(1);
    expect(frames.isPending()).toBe(false);
    expect(getBusyPlaceholderCount()).toBe(0);
  });

  it('returns to the seed warehouses on the reset button without waiting for the settings again', async () => {
    const { frames, getBusyPlaceholderCount, runtime } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    await createWarehouse(runtime);
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT + 1);

    fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['warehouse.resetDemo.label'] }));

    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: defaultLocaleCatalog['warehouse.resetDemo.label'] }).hasAttribute('disabled')).toBe(false);
    });
    expect(getBrand()).toBeDefined();
    expect(getBusyPlaceholderCount()).toBe(0);
  });
});

const getNavigationTitles = (): string[] => {
  const navigation = screen.getByRole('navigation', { name: defaultLocaleCatalog['app.nav.label'] });

  return within(navigation).getAllByRole('link').map(link => link.textContent);
};

const getSectionTitle = (section: AppSectionValue): string => defaultLocaleCatalog[SECTION_TITLE_KEYS[section]];

const findPersonaSelect = async (): Promise<HTMLSelectElement> => {
  const select = await screen.findByRole<HTMLSelectElement>('combobox', { name: defaultLocaleCatalog['persona.label'] });

  await waitFor(() => {
    expect(select.options.length).toBeGreaterThan(1);
  });

  return select;
};

describe('App sections of the persona on the demo engine', () => {
  it('opens the storekeeper on the warehouse with one section and one warehouse', async () => {
    const { frames, location } = await startApplication({
      initialPath: '/',
      preferredContext: { organizationId: SeedOrganizationId.BUYER_1, userId: SeedUserId.STOREKEEPER_1 },
    });

    expect(location.history).toEqual(['/warehouse']);
    expect(getNavigationTitles()).toEqual([getSectionTitle('warehouse')]);
    await expectWarehouseCount(frames, 1);
  });

  it('replaces a section that the storekeeper cannot open with the warehouse', async () => {
    const { location } = await startApplication({
      initialPath: '/catalog',
      preferredContext: { organizationId: SeedOrganizationId.BUYER_1, userId: SeedUserId.STOREKEEPER_1 },
    });

    expect(location.history).toEqual(['/warehouse']);
  });

  it('shows the administrator of the buyer all four sections', async () => {
    await startApplication({ initialPath: '/network' });

    expect(getNavigationTitles()).toEqual(APP_SECTIONS.map(getSectionTitle));
  });

  it('mounts the application again for the chosen persona and never shows the data of the previous one', async () => {
    const { frames, location } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    const previousRegion = screen.getByRole('region', { name: defaultLocaleCatalog['warehouse.warehouses.title'] });
    const shownCounts: number[] = [];
    const observer = new MutationObserver(() => {
      const region = screen.queryByRole('region', { name: defaultLocaleCatalog['warehouse.warehouses.title'] });

      if (region === null || region === previousRegion) {
        return;
      }

      const loadedCount = within(region).queryAllByRole('listitem').filter(item => item.closest('[aria-busy="true"]') === null).length;

      if (loadedCount > 0) {
        shownCounts.push(loadedCount);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    fireEvent.change(await findPersonaSelect(), { target: { value: SeedPersonaId.FRESH_STOREKEEPER } });
    await expectWarehouseCount(frames, 1);
    observer.disconnect();

    expect(shownCounts.length).toBeGreaterThan(0);
    expect(shownCounts.filter(count => count !== 1)).toEqual([]);
    expect(getNavigationTitles()).toEqual([getSectionTitle('warehouse')]);
    expect(location.read().path).toBe('/warehouse');
  });

  it('leads the persona that switches to the carrier away from the warehouse and changes the brand', async () => {
    const { location } = await startApplication({ initialPath: '/deals' });

    fireEvent.change(await findPersonaSelect(), { target: { value: SeedPersonaId.FRESH_CARRIER } });

    expect(await screen.findByText('Логист 1', { selector: 'header p' })).toBeDefined();
    await waitFor(() => {
      expect(getNavigationTitles()).toEqual([getSectionTitle('network'), getSectionTitle('deals')]);
    });
    expect(location.read().path).toBe('/deals');
  });

  it('replaces the warehouse with the first section when the persona switches to the carrier', async () => {
    const { frames, location } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);

    fireEvent.change(await findPersonaSelect(), { target: { value: SeedPersonaId.FRESH_CARRIER } });

    expect(await screen.findByRole('heading', { level: 1, name: getSectionTitle('network') })).toBeDefined();
    expect(location.read().path).toBe('/network');
  });
});
