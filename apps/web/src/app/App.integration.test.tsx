import { createInProcessEngineConnection } from '@skladburg/demo-engine/testing';
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
  ApiRuntimeValue,
  IFrameScheduler,
} from '@/shared/api';

import {
  createApiRuntime,
  createIdempotencyKey,
  createQueryClient,
  syncQueriesWithRealtime,
} from '@/shared/api';
import { createLocalizer } from '@/shared/i18n';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { App } from './App';

const BRAND_NAME = 'Покупатель 1';
const SEED_WAREHOUSE_COUNT = 3;
const LIST_WAREHOUSES_PATH = '/ListWarehouses';

interface HarnessValue {
  frames: ManualFramesValue;
  getBusyPlaceholderCount: () => number;
  getListWarehousesCallCount: () => number;
  runtime: ApiRuntimeValue;
}

interface ManualFramesValue {
  flushFrame: () => void;
  isPending: () => boolean;
  scheduler: IFrameScheduler;
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

const startApplication = async (): Promise<HarnessValue> => {
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

  render(
    <StrictMode>
      <App localizer={localizer} location={createMemoryLocation('/warehouse')} queryClient={queryClient} runtime={runtime} />
    </StrictMode>,
  );

  closers.push(async () => {
    stopSync();
    runtime.close();
    await inProcess.close();
  });

  await screen.findByRole('heading', { level: 1, name: defaultLocaleCatalog['section.warehouse.title'] });
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
