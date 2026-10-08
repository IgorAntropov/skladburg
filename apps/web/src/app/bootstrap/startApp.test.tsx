import type { MockInstance } from 'vitest';

import { create } from '@bufbuild/protobuf';
import {
  GetOrganizationSettingsResponseSchema,
  OrganizationService,
  OrganizationSettingsSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  createInProcessEngineConnection,
  SeedOrganizationId,
  SeedPersonaId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
import { QueryClient } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import {
  defaultLocaleCatalog,
  defaultTenant,
} from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  ApiRuntimeValue,
  IDemoControl,
} from '@/shared/api';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import {
  ACTING_CONTEXT_STORAGE_KEY,
  createApiRuntime,
  createQueryClient,
  persistActingContext,
  syncQueriesWithRealtime,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from '@/shared/api/index.testing';
import { createLocalizer } from '@/shared/i18n';
import { observeLongTasks } from '@/shared/lib/performance';
import {
  APP_SECTIONS,
  createHashLocation,
} from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { registerSessionRoute } from '../lib/testing/sessionFixtures';
import { readDeviceTimeZone } from './readDeviceTimeZone';
import { startApp } from './startApp';

vi.mock('./readDeviceTimeZone', () => ({ readDeviceTimeZone: vi.fn(() => 'Asia/Vladivostok') }));

vi.mock('@/shared/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/api')>();

  return {
    ...original,
    createApiRuntime: vi.fn(original.createApiRuntime),
    createQueryClient: vi.fn(original.createQueryClient),
    persistActingContext: vi.fn(original.persistActingContext),
    syncQueriesWithRealtime: vi.fn(original.syncQueriesWithRealtime),
  };
});

vi.mock('@/shared/lib/performance', () => ({ observeLongTasks: vi.fn() }));

vi.mock('@/shared/routing', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/routing')>();

  return { ...original, createHashLocation: vi.fn(original.createHashLocation) };
});

vi.mock('react-dom/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-dom/client')>();

  return { ...original, createRoot: vi.fn(original.createRoot) };
});

vi.mock('@/shared/i18n', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/i18n')>();

  return { ...original, createLocalizer: vi.fn(original.createLocalizer) };
});

const WAREHOUSE_PATH = '/warehouse';
const ENGINE_BRAND = 'Северный склад';
const ENGINE_ORGANIZATION_ID = 'f4000001-0000-4000-8000-000000000000';

const createDemoControl = (): IDemoControl => ({
  listPersonas: () => Promise.resolve([]),
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset: () => Promise.resolve(),
});

const createRuntime = (close: () => void = vi.fn(), demoControl?: IDemoControl): ApiRuntimeValue => ({
  ...createTestRuntime({
    demoControl,
    routes: (router) => {
      registerSessionRoute(router);
      router.service(OrganizationService, {
        getOrganizationSettings: () => create(GetOrganizationSettingsResponseSchema, {
          settings: create(OrganizationSettingsSchema, {
            availableLocales: ['ru'],
            brandName: ENGINE_BRAND,
            defaultLocale: 'ru',
            organizationId: ENGINE_ORGANIZATION_ID,
          }),
        }),
      });
    },
  }),
  close,
});

const createRootElement = (): HTMLElement => {
  const rootElement = document.createElement('div');

  document.body.append(rootElement);

  return rootElement;
};

const expectButtonEnabled = (): void => {
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false);
};

const getLoggedLabels = (spy: MockInstance<typeof console.error>): unknown[] => {
  return spy.mock.calls.map(([label]: unknown[]) => label);
};

const failFirstRender = async (): Promise<void> => {
  const original = await vi.importActual<typeof import('react-dom/client')>('react-dom/client');
  let renderCount = 0;

  vi.mocked(createRoot).mockImplementationOnce((container) => {
    const root = original.createRoot(container);

    return {
      render: (children) => {
        renderCount += 1;

        if (renderCount === 1) {
          throw new Error('render failed');
        }

        root.render(children);
      },
      unmount: () => {
        root.unmount();
      },
    };
  });
};

const findBrand = async (): Promise<HTMLElement> => within(await screen.findByRole('banner')).findByText(ENGINE_BRAND);

describe('startApp', () => {
  beforeEach(() => {
    vi.mocked(createApiRuntime).mockReset();
    vi.mocked(createApiRuntime).mockImplementation(() => Promise.resolve(createRuntime()));
    vi.mocked(createQueryClient).mockReset();
    vi.mocked(syncQueriesWithRealtime).mockReset();
    vi.mocked(persistActingContext).mockClear();
    window.sessionStorage.clear();
    vi.mocked(createLocalizer).mockReset();
    vi.mocked(observeLongTasks).mockClear();
    vi.mocked(createHashLocation).mockReset();
    vi.mocked(createHashLocation).mockImplementation(() => createMemoryLocation(WAREHOUSE_PATH));
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('renders the application with the settings from the engine', async () => {
    await startApp(createRootElement());

    expect(await findBrand()).toBeDefined();
    expect(document.title).toBe(
      defaultLocaleCatalog['app.documentTitle']
        .replace('{section}', defaultLocaleCatalog['section.warehouse.title'])
        .replace('{brand}', ENGINE_BRAND),
    );
    expect(createApiRuntime).toHaveBeenCalledOnce();
    expect(createApiRuntime).toHaveBeenCalledWith({
      defaultOrganizationId: defaultTenant.tenantId,
      preferredContext: undefined,
      preferredPersonaId: undefined,
    });
  });

  it('creates the query client for the network mode of the runtime and synchronizes it with the realtime channel', async () => {
    const runtime = createRuntime();
    vi.mocked(createApiRuntime).mockResolvedValueOnce({ ...runtime, networkMode: 'online' });

    await startApp(createRootElement());
    await findBrand();

    expect(createQueryClient).toHaveBeenCalledExactlyOnceWith({ networkMode: 'online' });
    expect(syncQueriesWithRealtime).toHaveBeenCalledOnce();

    const syncOptions = vi.mocked(syncQueriesWithRealtime).mock.calls[0]?.[0];

    expect(syncOptions?.demoControl).toBe(runtime.demoControl);
    expect(syncOptions?.realtime).toBe(runtime.realtime);
    expect(syncOptions?.queryClient).toBeInstanceOf(QueryClient);
  });

  it('reports a runtime failure to the console and renders the start error screen', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(createApiRuntime).mockRejectedValueOnce(new Error('the engine is unavailable'));

    await startApp(createRootElement());

    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0]?.[0]).toBe('> startApp -> tryStart:');
    expect(consoleError.mock.calls[0]?.[1]).toMatchObject({ tenantId: defaultTenant.tenantId });
    expect((await screen.findByRole('alert')).textContent).toBe(defaultLocaleCatalog['app.startError.message']);
    expect(screen.getByRole('button', { name: defaultLocaleCatalog['app.startError.retry'] })).toBeDefined();
  });

  it('renders the application in the same root after a successful retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(createApiRuntime).mockRejectedValueOnce(new Error('the engine is unavailable'));
    const rootElement = createRootElement();

    await startApp(rootElement);
    fireEvent.click(await screen.findByRole('button'));

    expect(await findBrand()).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(rootElement.querySelector('main')).not.toBeNull();
    expect(document.querySelectorAll('main')).toHaveLength(1);
  });

  it('keeps the start error screen and re-enables the button after a failed retry', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const expectErrorLoggedTwice = (): void => {
      expect(consoleError).toHaveBeenCalledTimes(2);
    };
    vi.mocked(createApiRuntime)
      .mockRejectedValueOnce(new Error('the engine is unavailable'))
      .mockRejectedValueOnce(new Error('still unavailable'));

    await startApp(createRootElement());
    fireEvent.click(await screen.findByRole('button'));

    await waitFor(expectErrorLoggedTwice);
    await waitFor(expectButtonEnabled);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('button', { name: defaultLocaleCatalog['app.startError.retry'] })).toBeDefined();
    expect(consoleError.mock.calls[1]?.[0]).toBe('> startApp -> tryStart:');
  });

  it('shows the progress state while the retry is starting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let failRetry: (reason: Error) => void = () => undefined;
    const retrying = new Promise<ApiRuntimeValue>((_resolve, reject) => {
      failRetry = reject;
    });
    vi.mocked(createApiRuntime)
      .mockRejectedValueOnce(new Error('the engine is unavailable'))
      .mockReturnValueOnce(retrying);

    await startApp(createRootElement());
    fireEvent.click(await screen.findByRole('button'));

    const button = await screen.findByRole('button', { name: defaultLocaleCatalog['app.startError.retrying'] });

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    failRetry(new Error('still unavailable'));

    await waitFor(expectButtonEnabled);
  });

  it('retries the localizer of the profile and shows the start error on the fallback localizer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const original = await vi.importActual<typeof import('@/shared/i18n')>('@/shared/i18n');
    vi.mocked(createLocalizer)
      .mockRejectedValueOnce(new Error('catalog chunk is unavailable'))
      .mockImplementation(original.createLocalizer);

    await startApp(createRootElement());

    expect((await screen.findByRole('alert')).textContent).toBe(defaultLocaleCatalog['app.startError.message']);
    expect(createApiRuntime).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button'));

    expect(await findBrand()).toBeDefined();
    expect(createLocalizer).toHaveBeenCalledTimes(3);
    expect(createApiRuntime).toHaveBeenCalledOnce();
  });

  it('reads the device time zone once and gives it to every localizer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const original = await vi.importActual<typeof import('@/shared/i18n')>('@/shared/i18n');
    vi.mocked(createLocalizer)
      .mockRejectedValueOnce(new Error('catalog chunk is unavailable'))
      .mockImplementation(original.createLocalizer);
    vi.mocked(readDeviceTimeZone).mockClear();

    await startApp(createRootElement());
    fireEvent.click(await screen.findByRole('button'));
    await findBrand();

    expect(readDeviceTimeZone).toHaveBeenCalledOnce();
    expect(createLocalizer).toHaveBeenCalledTimes(3);

    for (const [options] of vi.mocked(createLocalizer).mock.calls) {
      expect(options.userTimeZone).toBe('Asia/Vladivostok');
    }
  });

  it.each([
    { failingStep: createQueryClient, name: 'the query client cannot be created' },
    { failingStep: syncQueriesWithRealtime, name: 'the realtime synchronization cannot start' },
  ])('closes the runtime when $name', async ({ failingStep }) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const close = vi.fn();
    vi.mocked(createApiRuntime).mockResolvedValueOnce(createRuntime(close));
    vi.mocked(failingStep).mockImplementationOnce(() => {
      throw new Error('startup step failed');
    });

    await startApp(createRootElement());

    expect(close).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0]?.[0]).toBe('> startApp -> tryStart:');
    expect(await screen.findByRole('alert')).toBeDefined();
  });

  it('closes the runtime of the failed attempt before it creates the next one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const events: string[] = [];
    let openRuntimeCount = 0;
    const createTrackedRuntime = (name: string): ApiRuntimeValue => {
      openRuntimeCount += 1;
      events.push(`create ${name}`);

      return createRuntime(() => {
        openRuntimeCount -= 1;
        events.push(`close ${name}`);
      });
    };
    vi.mocked(createApiRuntime)
      .mockImplementationOnce(() => Promise.resolve(createTrackedRuntime('first')))
      .mockImplementationOnce(() => Promise.resolve(createTrackedRuntime('second')));
    vi.mocked(syncQueriesWithRealtime).mockImplementationOnce(() => {
      throw new Error('startup step failed');
    });

    await startApp(createRootElement());

    expect(events).toEqual(['create first', 'close first']);

    fireEvent.click(await screen.findByRole('button'));

    expect(await findBrand()).toBeDefined();
    expect(events).toEqual(['create first', 'close first', 'create second']);
    expect(openRuntimeCount).toBe(1);
  });

  it('still shows the start error screen when closing the runtime fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(createApiRuntime).mockResolvedValueOnce(createRuntime(() => {
      throw new Error('worker is already gone');
    }));
    vi.mocked(createQueryClient).mockImplementationOnce(() => {
      throw new Error('startup step failed');
    });

    await startApp(createRootElement());

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(getLoggedLabels(consoleError)).toEqual(['> startApp -> tryStart:', '> startApp -> release:']);
  });

  it('stops the realtime synchronization when the render fails after it started', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const stopSync = vi.fn();
    vi.mocked(syncQueriesWithRealtime).mockReturnValueOnce(stopSync);
    await failFirstRender();

    await startApp(createRootElement());

    expect(stopSync).toHaveBeenCalledOnce();
    expect(await screen.findByRole('alert')).toBeDefined();
  });

  it('stops the synchronization of the failed attempt before it creates the next runtime', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const events: string[] = [];
    const createTrackedRuntime = (name: string): ApiRuntimeValue => {
      events.push(`create ${name}`);

      return createRuntime(() => {
        events.push(`close ${name}`);
      });
    };
    vi.mocked(createApiRuntime)
      .mockImplementationOnce(() => Promise.resolve(createTrackedRuntime('first')))
      .mockImplementationOnce(() => Promise.resolve(createTrackedRuntime('second')));
    vi.mocked(syncQueriesWithRealtime)
      .mockReturnValueOnce(() => {
        events.push('stop first');
      })
      .mockReturnValueOnce(() => {
        events.push('stop second');
      });
    await failFirstRender();

    await startApp(createRootElement());

    expect(events).toEqual(['create first', 'stop first', 'close first']);

    fireEvent.click(await screen.findByRole('button'));

    expect(await findBrand()).toBeDefined();
    expect(events).toEqual(['create first', 'stop first', 'close first', 'create second']);
  });

  it('starts the long task monitor once before the first start attempt', async () => {
    await startApp(createRootElement());
    await findBrand();

    expect(observeLongTasks).toHaveBeenCalledOnce();

    const monitorOrder = vi.mocked(observeLongTasks).mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const runtimeOrder = vi.mocked(createApiRuntime).mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY;

    expect(monitorOrder).toBeLessThan(runtimeOrder);
  });

  it('does not start the long task monitor again on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(createApiRuntime).mockRejectedValueOnce(new Error('the engine is unavailable'));

    await startApp(createRootElement());
    fireEvent.click(await screen.findByRole('button'));
    await findBrand();

    expect(createApiRuntime).toHaveBeenCalledTimes(2);
    expect(observeLongTasks).toHaveBeenCalledOnce();
  });

  it('creates the hash location once for the window and keeps it across retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(createApiRuntime).mockRejectedValueOnce(new Error('the engine is unavailable'));

    await startApp(createRootElement());
    fireEvent.click(await screen.findByRole('button'));
    await findBrand();

    expect(createApiRuntime).toHaveBeenCalledTimes(2);
    expect(createHashLocation).toHaveBeenCalledExactlyOnceWith(window);
  });

  it('opens the first section instead of the empty address and leaves no empty entry behind', async () => {
    const location = createMemoryLocation('/');
    vi.mocked(createHashLocation).mockReturnValue(location);

    await startApp(createRootElement());

    expect(await screen.findByRole('heading', { level: 1, name: defaultLocaleCatalog['section.network.title'] })).toBeDefined();
    expect(location.history).toEqual(['/network']);
  });

  describe('acting context of the tab', () => {
    const PERSONA_ID = SeedPersonaId.FRESH_STOREKEEPER;

    const startWithAddress = async (address: string, isDemo = true): Promise<IMemoryLocation> => {
      const location = createMemoryLocation(address);
      vi.mocked(createHashLocation).mockReturnValue(location);
      vi.mocked(createApiRuntime).mockResolvedValue(createRuntime(vi.fn(), isDemo ? createDemoControl() : undefined));

      await startApp(createRootElement());
      await findBrand();

      return location;
    };

    it('gives the persona from the address to the runtime and removes the parameter from the address', async () => {
      const location = await startWithAddress(`/deals?as=${PERSONA_ID}`);

      expect(vi.mocked(createApiRuntime).mock.calls[0]?.[0].preferredPersonaId).toBe(PERSONA_ID);
      expect(location.history).toEqual(['/deals']);
    });

    it('keeps the other parameters of the address and replaces the entry instead of adding one', async () => {
      const location = await startWithAddress(`/network?tab=open&as=${PERSONA_ID}&sort=date`);

      expect(location.history).toEqual(['/network?tab=open&sort=date']);
      expect(location.currentIndex).toBe(0);
    });

    it('removes the parameter silently when the persona is unknown and still lets the runtime decide', async () => {
      const location = await startWithAddress('/deals?as=unknown-persona');

      expect(vi.mocked(createApiRuntime).mock.calls[0]?.[0].preferredPersonaId).toBe('unknown-persona');
      expect(location.history).toEqual(['/deals']);
    });

    it('leaves the address alone when it has no persona parameter', async () => {
      const location = await startWithAddress('/deals?tab=open');

      expect(vi.mocked(createApiRuntime).mock.calls[0]?.[0].preferredPersonaId).toBeUndefined();
      expect(location.history).toEqual(['/deals?tab=open']);
    });

    it('ignores the persona parameter outside the demo and keeps it in the address', async () => {
      const location = await startWithAddress(`/deals?as=${PERSONA_ID}`, false);

      expect(location.history).toEqual([`/deals?as=${PERSONA_ID}`]);
    });

    it('gives the context saved in the tab to the runtime', async () => {
      const savedContext = { organizationId: ENGINE_ORGANIZATION_ID, userId: TEST_USER_ID };
      window.sessionStorage.setItem(ACTING_CONTEXT_STORAGE_KEY, JSON.stringify(savedContext));

      await startWithAddress('/deals');

      expect(vi.mocked(createApiRuntime).mock.calls[0]?.[0].preferredContext).toEqual(savedContext);
    });

    it('gives nothing as the saved context when the stored value is broken', async () => {
      window.sessionStorage.setItem(ACTING_CONTEXT_STORAGE_KEY, '{broken');

      await startWithAddress('/deals');

      expect(vi.mocked(createApiRuntime).mock.calls[0]?.[0].preferredContext).toBeUndefined();
    });

    it('saves the context of the runtime in the tab at once and on every change', async () => {
      const runtime = createRuntime(vi.fn(), createDemoControl());
      vi.mocked(createApiRuntime).mockResolvedValue(runtime);
      vi.mocked(createHashLocation).mockReturnValue(createMemoryLocation('/deals'));

      await startApp(createRootElement());
      await findBrand();

      expect(window.sessionStorage.getItem(ACTING_CONTEXT_STORAGE_KEY)).toBe(
        JSON.stringify({ organizationId: TEST_ORGANIZATION_ID, userId: TEST_USER_ID }),
      );

      runtime.actingContext.set({ organizationId: ENGINE_ORGANIZATION_ID, userId: PERSONA_ID });

      expect(window.sessionStorage.getItem(ACTING_CONTEXT_STORAGE_KEY)).toBe(
        JSON.stringify({ organizationId: ENGINE_ORGANIZATION_ID, userId: PERSONA_ID }),
      );
    });

    it('stops saving the context when the runtime is released after a failed start', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const stopPersist = vi.fn();
      vi.mocked(persistActingContext).mockReturnValueOnce(stopPersist);
      await failFirstRender();

      await startApp(createRootElement());

      expect(stopPersist).toHaveBeenCalledOnce();
      expect(await screen.findByRole('alert')).toBeDefined();
    });

    it('stops saving the context of the failed attempt before it creates the next runtime', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const events: string[] = [];
      vi.mocked(createApiRuntime)
        .mockImplementationOnce(() => {
          events.push('create first');

          return Promise.resolve(createRuntime(() => {
            events.push('close first');
          }));
        })
        .mockImplementationOnce(() => {
          events.push('create second');

          return Promise.resolve(createRuntime());
        });
      vi.mocked(persistActingContext).mockReturnValueOnce(() => {
        events.push('stop persist first');
      });
      await failFirstRender();

      await startApp(createRootElement());
      fireEvent.click(await screen.findByRole('button'));
      await findBrand();

      expect(events).toEqual(['create first', 'stop persist first', 'close first', 'create second']);
    });

    it('closes the runtime and reports the failure when stopping the saving throws', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const close = vi.fn();
      vi.mocked(createApiRuntime).mockResolvedValueOnce(createRuntime(close));
      vi.mocked(persistActingContext).mockReturnValueOnce(() => {
        throw new Error('storage is gone');
      });
      await failFirstRender();

      await startApp(createRootElement());

      expect(close).toHaveBeenCalledOnce();
      expect(getLoggedLabels(consoleError)).toContain('> startApp -> release:');
    });

    describe('on the demo engine', () => {
      const closers: (() => Promise<void>)[] = [];

      const startOnEngine = async (address: string): Promise<IMemoryLocation> => {
        const inProcess = createInProcessEngineConnection();
        const original = await vi.importActual<typeof import('@/shared/api')>('@/shared/api');
        const location = createMemoryLocation(address);

        closers.push(inProcess.close);
        vi.mocked(createApiRuntime).mockImplementation(options => original.createApiRuntime({
          ...options,
          connection: inProcess.connection,
        }));
        vi.mocked(createHashLocation).mockReturnValue(location);

        await startApp(createRootElement());

        return location;
      };

      const getNavigationLinks = (): string[] => {
        const navigation = screen.getByRole('navigation', { name: defaultLocaleCatalog['app.nav.label'] });

        return within(navigation).getAllByRole('link').map(link => link.textContent);
      };

      afterEach(async () => {
        cleanup();

        for (const close of closers.splice(0)) {
          await close();
        }
      });

      it('opens the storekeeper from the address on the warehouse with the only section', async () => {
        const location = await startOnEngine(`/?as=${SeedPersonaId.FRESH_STOREKEEPER}`);

        expect(await screen.findByRole('heading', { level: 1, name: defaultLocaleCatalog['section.warehouse.title'] })).toBeDefined();
        expect(getNavigationLinks()).toEqual([defaultLocaleCatalog['section.warehouse.title']]);
        expect(location.history).toEqual(['/warehouse']);
        expect(window.sessionStorage.getItem(ACTING_CONTEXT_STORAGE_KEY)).toContain(SeedUserId.STOREKEEPER_1);
      });

      it('opens the profile persona with all sections when the persona from the address is unknown', async () => {
        const location = await startOnEngine('/deals?as=unknown-persona');

        expect(await screen.findByRole('heading', { level: 1, name: defaultLocaleCatalog['section.deals.title'] })).toBeDefined();
        expect(getNavigationLinks()).toHaveLength(APP_SECTIONS.length);
        expect(location.history).toEqual(['/deals']);
      });

      it('opens the persona saved in the tab when the address names none', async () => {
        window.sessionStorage.setItem(
          ACTING_CONTEXT_STORAGE_KEY,
          JSON.stringify({ organizationId: SeedOrganizationId.BUYER_1, userId: SeedUserId.STOREKEEPER_1 }),
        );

        const location = await startOnEngine('/');

        expect(await screen.findByRole('heading', { level: 1, name: defaultLocaleCatalog['section.warehouse.title'] })).toBeDefined();
        expect(location.history).toEqual(['/warehouse']);
      });

      it('lets the address win over the persona saved in the tab', async () => {
        window.sessionStorage.setItem(
          ACTING_CONTEXT_STORAGE_KEY,
          JSON.stringify({ organizationId: SeedOrganizationId.BUYER_1, userId: SeedUserId.STOREKEEPER_1 }),
        );

        await startOnEngine(`/network?as=${SeedPersonaId.FRESH_BUYER}`);

        expect(await screen.findByRole('heading', { level: 1, name: defaultLocaleCatalog['section.network.title'] })).toBeDefined();
        expect(getNavigationLinks()).toHaveLength(APP_SECTIONS.length);
      });
    });
  });
});
