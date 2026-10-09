import {
  createInProcessEngineConnection,
  SeedOrganizationId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
import {
  act,
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
import {
  APP_SECTIONS,
  SECTION_TITLE_KEYS,
} from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { App } from './App';
import { createTestThemeStore } from './lib/testing/themeFixtures';

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

  it('returns to the seed warehouses on the reset button after the confirmation without waiting for the settings again', async () => {
    const { frames, getBusyPlaceholderCount, runtime } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    await createWarehouse(runtime);
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT + 1);

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: defaultLocaleCatalog['demo.reset.label'] }));
    const confirmation = screen.getByRole('group', { name: defaultLocaleCatalog['demo.reset.confirm.prompt'] });

    expect(getWarehouseItems()).toHaveLength(SEED_WAREHOUSE_COUNT + 1);

    fireEvent.click(within(confirmation).getByRole('button', { name: defaultLocaleCatalog['demo.reset.confirm.accept'] }));

    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    await waitFor(() => {
      expect(within(screen.getByRole('banner')).getByRole('button', { name: defaultLocaleCatalog['demo.reset.label'] })).toBeDefined();
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

const formatPersonaOption = (kindKey: 'persona.kind.carrier' | 'persona.kind.storekeeper', organizationName: string): string => {
  return defaultLocaleCatalog['persona.option']
    .replace('{kind}', defaultLocaleCatalog[kindKey])
    .replace('{organization}', organizationName);
};

const STOREKEEPER_OPTION = formatPersonaOption('persona.kind.storekeeper', BRAND_NAME);
const CARRIER_OPTION = formatPersonaOption('persona.kind.carrier', 'Логист 1');

const choosePersona = async (optionName: string): Promise<void> => {
  const trigger = await screen.findByRole('button', { name: new RegExp(`^${defaultLocaleCatalog['persona.label']}`) });

  await waitFor(() => {
    expect(trigger.getAttribute('aria-disabled')).toBeNull();
    expect(trigger.hasAttribute('disabled')).toBe(false);
    expect(trigger.getAttribute('aria-label')).toContain(`${defaultLocaleCatalog['persona.label']}:`);
  });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });

  const option = await screen.findByRole('menuitemradio', { name: optionName });

  option.focus();
  fireEvent.keyDown(option, { key: 'Enter' });
};

const PERSONA_TRIGGER_NAME = new RegExp(`^${defaultLocaleCatalog['persona.label']}`);
const MENU_BUTTON_NAME = defaultLocaleCatalog['menu.open'];

const getLiveRegion = (): HTMLElement => {
  const region = document.querySelector<HTMLElement>('body > div > [aria-live="polite"]');

  if (region === null) {
    throw new TypeError('The live region of the application is missing');
  }

  return region;
};

interface AnnouncementWatchValue {
  getHeard: () => string[];
  stop: () => void;
}

const watchAnnouncements = (): AnnouncementWatchValue => {
  const heard: string[] = [];
  const region = getLiveRegion();
  const observer = new MutationObserver(() => {
    const message = region.textContent;

    if (message !== '' && heard.at(-1) !== message) {
      heard.push(message);
    }
  });

  observer.observe(region, { childList: true, subtree: true });

  const stop = (): void => {
    observer.disconnect();
  };

  return { getHeard: () => heard, stop };
};

const chooseFromPhoneMenu = async (optionName: string): Promise<void> => {
  const menuButton = await screen.findByRole('button', { name: MENU_BUTTON_NAME });

  fireEvent.click(menuButton);

  const menu = await screen.findByRole('menu', { name: defaultLocaleCatalog['menu.label'] });
  const option = await within(menu).findByRole('menuitemradio', { name: optionName });

  option.focus();
  fireEvent.keyDown(option, { key: 'Enter' });
};

describe('App focus and announcements when the persona changes', () => {
  it('puts the focus on the trigger of the new switcher and announces the switch and the arrival', async () => {
    const { frames } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    const previousTrigger = await screen.findByRole('button', { name: PERSONA_TRIGGER_NAME });
    const watch = watchAnnouncements();

    await choosePersona(STOREKEEPER_OPTION);

    await waitFor(() => {
      expect(watch.getHeard()).toEqual([
        defaultLocaleCatalog['persona.switching'],
        defaultLocaleCatalog['persona.switched'].replace('{persona}', STOREKEEPER_OPTION),
      ]);
    });
    const trigger = await screen.findByRole('button', { name: PERSONA_TRIGGER_NAME });

    expect(trigger).not.toBe(previousTrigger);
    await waitFor(() => {
      expect(trigger.hasAttribute('disabled')).toBe(false);
      expect(document.activeElement).toBe(trigger);
    });
    watch.stop();
  });

  it('puts the focus on the menu button of the new bar when the persona is chosen in the phone menu', async () => {
    const { frames } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    const previousMenuButton = await screen.findByRole('button', { name: MENU_BUTTON_NAME });
    const watch = watchAnnouncements();

    await chooseFromPhoneMenu(STOREKEEPER_OPTION);

    await waitFor(() => {
      expect(watch.getHeard()).toEqual([
        defaultLocaleCatalog['persona.switching'],
        defaultLocaleCatalog['persona.switched'].replace('{persona}', STOREKEEPER_OPTION),
      ]);
    });
    await waitFor(() => {
      const menuButton = screen.getByRole('button', { name: MENU_BUTTON_NAME });

      expect(menuButton).not.toBe(previousMenuButton);
      expect(document.activeElement).toBe(menuButton);
    });
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 60);
      });
    });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: MENU_BUTTON_NAME }));
    watch.stop();
  });
});

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
    await choosePersona(STOREKEEPER_OPTION);
    await expectWarehouseCount(frames, 1);
    observer.disconnect();

    expect(shownCounts.length).toBeGreaterThan(0);
    expect(shownCounts.filter(count => count !== 1)).toEqual([]);
    expect(getNavigationTitles()).toEqual([getSectionTitle('warehouse')]);
    expect(location.read().path).toBe('/warehouse');
  });

  it('leads the persona that switches to the carrier away from the warehouse and changes the brand', async () => {
    const { location } = await startApplication({ initialPath: '/deals' });

    await choosePersona(CARRIER_OPTION);

    expect(await screen.findByText('Логист 1', { selector: 'header p' })).toBeDefined();
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
