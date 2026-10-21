import {
  createInProcessEngineConnection,
  SeedOrganizationId,
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
import { SECTION_TITLE_KEYS } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { App } from './App';
import { createTestThemeStore } from './lib/testing/themeFixtures';

const BRAND_NAME = 'Заказчик 1';
const PRODUCT_NAME = defaultLocaleCatalog['app.productName'];
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

const formatProfileButtonName = (userDisplayName: string, organizationName: string): string => {
  return defaultLocaleCatalog['profile.button.label']
    .replace('{name}', userDisplayName)
    .replace('{organization}', organizationName);
};

const CUSTOMER_BUTTON_NAME = formatProfileButtonName('Анна Смирнова', BRAND_NAME);
const CARRIER_BUTTON_NAME = formatProfileButtonName('Дмитрий Васильев', 'Перевозчик 1');
const PROFILE_BUTTON_PATTERN = new RegExp(`^${defaultLocaleCatalog['profile.button.loading']}`);

const getProductName = (): HTMLElement => within(screen.getByRole('banner')).getByText(PRODUCT_NAME);

const findProfileButton = (name: string = CUSTOMER_BUTTON_NAME): Promise<HTMLElement> => screen.findByRole('button', { name });

const getProfileButton = (): HTMLElement => screen.getByRole('button', { name: PROFILE_BUTTON_PATTERN });

const openProfileMenu = async (buttonName: string = CUSTOMER_BUTTON_NAME): Promise<HTMLElement> => {
  const button = await findProfileButton(buttonName);

  fireEvent.click(button);

  return screen.findByRole('menu', { name: defaultLocaleCatalog['profile.menu.label'] });
};

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
    capabilities: [],
    cityId: template?.cityId ?? '',
    idempotencyKey: createIdempotencyKey(),
    mapNodeId: template?.mapNodeId ?? '',
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

  it('returns to the seed warehouses on the reset button after the confirmation without waiting for the settings again', async () => {
    const { frames, getBusyPlaceholderCount, runtime } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    await createWarehouse(runtime);
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT + 1);

    const menu = await openProfileMenu();
    const resetItem = within(menu).getByRole('menuitem', { name: defaultLocaleCatalog['demo.reset.menuItem'] });

    resetItem.focus();
    fireEvent.keyDown(resetItem, { key: 'Enter' });

    const confirmation = await screen.findByRole('group', { name: defaultLocaleCatalog['demo.reset.confirm.prompt'] });
    const busyPlaceholderCountBeforeReset = getBusyPlaceholderCount();

    expect(getWarehouseItems()).toHaveLength(SEED_WAREHOUSE_COUNT + 1);

    fireEvent.click(within(confirmation).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.accept'] }));

    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    await waitFor(() => {
      expect(screen.queryByRole('group', { name: defaultLocaleCatalog['demo.reset.confirm.prompt'] })).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(getProfileButton());
    });
    expect(getProductName()).toBeDefined();
    expect(await findProfileButton()).toBeDefined();
    expect(getBusyPlaceholderCount()).toBe(busyPlaceholderCountBeforeReset);
  });
});

const getNavigationTitles = (): string[] => {
  const navigation = screen.getByRole('navigation', { name: defaultLocaleCatalog['app.nav.label'] });

  return within(navigation).getAllByRole('link').map(link => link.textContent);
};

const getSectionTitle = (section: AppSectionValue): string => defaultLocaleCatalog[SECTION_TITLE_KEYS[section]];

const formatPersonaOption = (name: string, role: string, organizationName: string): string => {
  return defaultLocaleCatalog['persona.option']
    .replace('{name}', name)
    .replace('{role}', role)
    .replace('{organization}', organizationName);
};

const STOREKEEPER_OPTION = formatPersonaOption('Иван Соколов', 'Кладовщик', BRAND_NAME);
const CARRIER_OPTION = formatPersonaOption('Дмитрий Васильев', 'Директор', 'Перевозчик 1');

const choosePersona = async (optionName: string): Promise<void> => {
  const menu = await openProfileMenu();
  const option = await within(menu).findByRole('menuitemradio', { name: optionName });

  await waitFor(() => {
    expect(option.getAttribute('aria-disabled')).toBeNull();
    expect(option.hasAttribute('data-disabled')).toBe(false);
  });
  option.focus();
  fireEvent.keyDown(option, { key: 'Enter' });
};

describe('App sections of the persona on the demo engine', () => {
  it('opens the storekeeper on the warehouse with one section and one warehouse', async () => {
    const { frames, location } = await startApplication({
      initialPath: '/',
      preferredContext: { organizationId: SeedOrganizationId.CUSTOMER_1, userId: SeedUserId.STOREKEEPER_1 },
    });

    expect(location.history).toEqual(['/warehouse']);
    expect(getNavigationTitles()).toEqual([getSectionTitle('warehouse')]);
    await expectWarehouseCount(frames, 1);
  });

  it('replaces a section that the storekeeper cannot open with the warehouse', async () => {
    const { location } = await startApplication({
      initialPath: '/catalog',
      preferredContext: { organizationId: SeedOrganizationId.CUSTOMER_1, userId: SeedUserId.STOREKEEPER_1 },
    });

    expect(location.history).toEqual(['/warehouse']);
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
    await choosePersona(STOREKEEPER_OPTION);
    await expectWarehouseCount(frames, 1);
    observer.disconnect();

    expect(shownCounts.length).toBeGreaterThan(0);
    expect(shownCounts.filter(count => count !== 1)).toEqual([]);
    expect(getNavigationTitles()).toEqual([getSectionTitle('warehouse')]);
    expect(location.read().path).toBe('/warehouse');
  });

  it('leads the persona that switches to the carrier away from the warehouse and renames the profile button', async () => {
    const { location } = await startApplication({ initialPath: '/deals' });

    await choosePersona(CARRIER_OPTION);

    expect(await findProfileButton(CARRIER_BUTTON_NAME)).toBeDefined();
    await waitFor(() => {
      expect(getNavigationTitles()).toEqual([getSectionTitle('network'), getSectionTitle('deals')]);
    });
    expect(location.read().path).toBe('/deals');
  });

  it('replaces the warehouse with the first section when the persona switches to the carrier', async () => {
    const { frames, location } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);

    await choosePersona(CARRIER_OPTION);

    expect(await screen.findByRole('heading', { level: 1, name: getSectionTitle('network') })).toBeDefined();
    expect(location.read().path).toBe('/network');
  });
});
