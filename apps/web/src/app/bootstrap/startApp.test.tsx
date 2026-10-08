import type { MockInstance } from 'vitest';

import { create } from '@bufbuild/protobuf';
import {
  GetOrganizationSettingsResponseSchema,
  OrganizationService,
  OrganizationSettingsSchema,
} from '@skladburg/contracts/organization/v1/organization';
import { QueryClient } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
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

import type { ApiRuntimeValue } from '@/shared/api';

import {
  createApiRuntime,
  createQueryClient,
  syncQueriesWithRealtime,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { createLocalizer } from '@/shared/i18n';
import { observeLongTasks } from '@/shared/lib/performance';

import { startApp } from './startApp';

vi.mock('@/shared/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/api')>();

  return {
    ...original,
    createApiRuntime: vi.fn(original.createApiRuntime),
    createQueryClient: vi.fn(original.createQueryClient),
    syncQueriesWithRealtime: vi.fn(original.syncQueriesWithRealtime),
  };
});

vi.mock('@/shared/lib/performance', () => ({ observeLongTasks: vi.fn() }));

vi.mock('react-dom/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-dom/client')>();

  return { ...original, createRoot: vi.fn(original.createRoot) };
});

vi.mock('@/shared/i18n', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/i18n')>();

  return { ...original, createLocalizer: vi.fn(original.createLocalizer) };
});

const ENGINE_BRAND = 'Северный склад';
const ENGINE_ORGANIZATION_ID = 'f4000001-0000-4000-8000-000000000000';

const createRuntime = (close: () => void = vi.fn()): ApiRuntimeValue => ({
  ...createTestRuntime({
    routes: router => router.service(OrganizationService, {
      getOrganizationSettings: () => create(GetOrganizationSettingsResponseSchema, {
        settings: create(OrganizationSettingsSchema, {
          availableLocales: ['ru'],
          brandName: ENGINE_BRAND,
          defaultLocale: 'ru',
          organizationId: ENGINE_ORGANIZATION_ID,
        }),
      }),
    }),
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

const findBrandHeading = (): Promise<HTMLElement> => screen.findByRole('heading', { name: ENGINE_BRAND });

describe('startApp', () => {
  beforeEach(() => {
    vi.mocked(createApiRuntime).mockReset();
    vi.mocked(createApiRuntime).mockImplementation(() => Promise.resolve(createRuntime()));
    vi.mocked(createQueryClient).mockReset();
    vi.mocked(syncQueriesWithRealtime).mockReset();
    vi.mocked(createLocalizer).mockReset();
    vi.mocked(observeLongTasks).mockClear();
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('renders the application with the settings from the engine', async () => {
    await startApp(createRootElement());

    expect(await findBrandHeading()).toBeDefined();
    expect(document.title).toBe(ENGINE_BRAND);
    expect(createApiRuntime).toHaveBeenCalledOnce();
    expect(createApiRuntime).toHaveBeenCalledWith({ defaultOrganizationId: defaultTenant.tenantId });
  });

  it('creates the query client for the network mode of the runtime and synchronizes it with the realtime channel', async () => {
    const runtime = createRuntime();
    vi.mocked(createApiRuntime).mockResolvedValueOnce({ ...runtime, networkMode: 'online' });

    await startApp(createRootElement());
    await findBrandHeading();

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

    expect(await findBrandHeading()).toBeDefined();
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

    expect(await findBrandHeading()).toBeDefined();
    expect(createLocalizer).toHaveBeenCalledTimes(3);
    expect(createApiRuntime).toHaveBeenCalledOnce();
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

    expect(await findBrandHeading()).toBeDefined();
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

    expect(await findBrandHeading()).toBeDefined();
    expect(events).toEqual(['create first', 'stop first', 'close first', 'create second']);
  });

  it('starts the long task monitor once before the first start attempt', async () => {
    await startApp(createRootElement());
    await findBrandHeading();

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
    await findBrandHeading();

    expect(createApiRuntime).toHaveBeenCalledTimes(2);
    expect(observeLongTasks).toHaveBeenCalledOnce();
  });
});
