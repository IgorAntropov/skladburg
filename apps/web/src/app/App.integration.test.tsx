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
import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import {
  APP_SECTIONS,
  SECTION_TITLE_KEYS,
} from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { App } from './App';
import { createTestThemeStore } from './lib/testing/themeFixtures';

const BRAND_NAME = 'Заказчик 1';
const PRODUCT_NAME = defaultLocaleCatalog['app.productName'];
const SIGN_IN_LINE = /Войти как/;
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
const STOREKEEPER_BUTTON_NAME = formatProfileButtonName('Иван Соколов', BRAND_NAME);
const CARRIER_BUTTON_NAME = formatProfileButtonName('Дмитрий Васильев', 'Перевозчик 1');
const PROFILE_BUTTON_PATTERN = new RegExp(`^${defaultLocaleCatalog['profile.button.loading']}`);

const PERSONA_GROUP_PATTERN = new RegExp(`^${defaultLocaleCatalog['persona.group.label'].split('{group}')[0] ?? ''}`);
const PERSONA_COUNT = 8;

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
    boardNodeId: template?.boardNodeId ?? '',
    capabilities: [],
    cityId: template?.cityId ?? '',
    idempotencyKey: createIdempotencyKey(),
    name: 'Склад для события',
    timeZone: 'Europe/Moscow',
  });
};

const installPhoneViewport = (): void => {
  const fakeViewport = installFakeViewport('phone');

  closers.push(() => {
    fakeViewport.restore();

    return Promise.resolve();
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

    const productName = getProductName();

    expect(productName.getAttribute('translate')).toBe('no');
    expect(within(screen.getByRole('banner')).queryByText(BRAND_NAME)).toBeNull();
    expect(await findProfileButton()).toBeDefined();
    expect(within(screen.getByRole('banner')).queryByText(SIGN_IN_LINE)).toBeNull();
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
const CARRIER_OPTION = formatPersonaOption('Дмитрий Васильев', 'Администратор', 'Перевозчик 1');

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

const waitForSettledFocus = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 60);
    });
  });
};

describe.each(['desktop', 'phone'] as const)('App focus and announcements when the persona changes on a %s', (viewportClass) => {
  const prepare = (): void => {
    if (viewportClass === 'phone') {
      installPhoneViewport();
    }
  };

  it('puts the focus on the profile button of the new bar and announces the switch and the arrival', async () => {
    prepare();
    const { frames } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    const previousButton = await findProfileButton();
    const watch = watchAnnouncements();

    await choosePersona(STOREKEEPER_OPTION);

    await waitFor(() => {
      expect(watch.getHeard()).toEqual([
        defaultLocaleCatalog['persona.switching'],
        defaultLocaleCatalog['persona.switched'].replace('{persona}', STOREKEEPER_OPTION),
      ]);
    });
    const button = await findProfileButton(STOREKEEPER_BUTTON_NAME);

    expect(button).not.toBe(previousButton);
    expect(screen.queryByRole('button', { name: CUSTOMER_BUTTON_NAME })).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(button);
    });
    await waitForSettledFocus();

    expect(document.activeElement).toBe(await findProfileButton(STOREKEEPER_BUTTON_NAME));
    expect(screen.queryByRole('menu')).toBeNull();
    watch.stop();
  });

  it('names the new button with the user and the organization of the new persona', async () => {
    prepare();
    const { frames } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);

    await choosePersona(CARRIER_OPTION);

    const button = await findProfileButton(CARRIER_BUTTON_NAME);

    expect(button.getAttribute('aria-label')).toBe(CARRIER_BUTTON_NAME);
    expect(within(screen.getByRole('banner')).queryByText(SIGN_IN_LINE)).toBeNull();
  });

  it('marks the chosen persona as the only checked item of the reopened menu', async () => {
    prepare();
    const { frames } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    await choosePersona(STOREKEEPER_OPTION);
    await findProfileButton(STOREKEEPER_BUTTON_NAME);

    const menu = await openProfileMenu(STOREKEEPER_BUTTON_NAME);
    const option = await within(menu).findByRole('menuitemradio', { name: STOREKEEPER_OPTION });
    const personaItems = within(menu)
      .getAllByRole('group', { name: PERSONA_GROUP_PATTERN })
      .flatMap(group => within(group).getAllByRole('menuitemradio'));
    const checked = personaItems.filter(item => item.getAttribute('aria-checked') === 'true');

    expect(personaItems).toHaveLength(PERSONA_COUNT);
    expect(checked).toEqual([option]);
  });

  it('announces the error by its text and keeps the persona and the focus on the profile button when the engine refuses', async () => {
    prepare();
    const { frames, runtime } = await startApplication();
    await expectWarehouseCount(frames, SEED_WAREHOUSE_COUNT);
    await findProfileButton();
    const watch = watchAnnouncements();
    const setSpy = vi.spyOn(runtime.actingContext, 'set').mockImplementationOnce(() => {
      throw new Error('the engine refuses');
    });

    await choosePersona(STOREKEEPER_OPTION);

    await waitFor(() => {
      expect(watch.getHeard()).toEqual([
        defaultLocaleCatalog['persona.switching'],
        defaultLocaleCatalog['persona.switchError'],
      ]);
    });
    await waitForSettledFocus();

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: CUSTOMER_BUTTON_NAME }));
    expect(runtime.actingContext.get().userId).toBe(SeedUserId.ADMIN_1);
    expect(getWarehouseItems()).toHaveLength(SEED_WAREHOUSE_COUNT);
    watch.stop();
  });
});

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

  it('shows the administrator of the customer all four sections', async () => {
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
