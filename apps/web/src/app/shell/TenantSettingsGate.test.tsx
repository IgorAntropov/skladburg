import type { ConnectRouter } from '@connectrpc/connect';
import type { GetOrganizationSettingsResponse } from '@skladburg/contracts/organization/v1/organization';
import type { QueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { MockInstance } from 'vitest';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  AccessService,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  ClockService,
  GetWorldClockResponseSchema,
} from '@skladburg/contracts/clock/v1/clock';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  GetOrganizationSettingsResponseSchema,
  LocaleTermOverridesSchema,
  MessageOverrideSchema,
  OrganizationService,
  OrganizationSettingsSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
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

import type { ApiRuntimeValue } from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';

import { organizationKeys } from '@/entities/organization';
import { useSessionQuery } from '@/entities/session';
import {
  ApiRuntimeProvider,
  createQueryClient,
  useApiClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';
import {
  createLocalizer,
  LocalizerProvider,
  useI18n,
} from '@/shared/i18n';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';
import { useTenantSettings } from '@/shared/tenant';
import { createWorldClockQueryOptions } from '@/widgets/top-bar';

import { TenantSettingsGate } from './TenantSettingsGate';

const WAREHOUSE_PATH = '/warehouse';
const ORGANIZATION_ID = 'f3000001-0000-4000-8000-000000000000';
const FIRST_BRAND = 'Северный склад';
const SECOND_BRAND = 'Южный склад';
const FIRST_PLACEHOLDER = 'Склад «Север» скоро откроется';
const SECOND_PLACEHOLDER = 'Склад «Юг» скоро откроется';
const CLOCK_PENDING_TEXT = 'no clock';
const CLOCK_READY_TEXT = 'clock';
const OTHER_USER_ID = 'f1000003-0000-4000-8000-000000000000';

type ApplyTenantSpy = MockInstance<ILocalizer['applyTenant']>;

interface DeferredValue {
  promise: Promise<void>;
  reject: (reason: Error) => void;
  resolve: () => void;
}

interface RenderedGateValue {
  applyOriginal: ILocalizer['applyTenant'];
  applyTenant: ApplyTenantSpy;
  queryClient: QueryClient;
  runtime: ApiRuntimeValue;
}

interface RenderGateOptionsValue {
  children?: ReactElement;
  isStrict?: boolean;
  prepare?: (gate: RenderedGateValue) => void;
  routes?: (router: ConnectRouter) => void;
}

interface SettingsFixtureValue {
  brandName: string;
  placeholder?: string | undefined;
}

type SettingsResponse = ReturnType<typeof createSettingsResponse>;

const createSettingsResponse = ({ brandName, placeholder }: SettingsFixtureValue): GetOrganizationSettingsResponse => {
  const termOverrides = placeholder === undefined
    ? []
    : [
        create(LocaleTermOverridesSchema, {
          locale: 'ru',
          messages: { 'warehouse.placeholder': create(MessageOverrideSchema, { value: { case: 'text', value: placeholder } }) },
        }),
      ];

  return create(GetOrganizationSettingsResponseSchema, {
    settings: create(OrganizationSettingsSchema, {
      availableLocales: ['ru'],
      brandName,
      defaultLocale: 'ru',
      organizationId: ORGANIZATION_ID,
      termOverrides,
    }),
  });
};

const createSettingsError = (): ConnectError => new ConnectError(
  'settings are broken',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code: ErrorCode.INVALID_TRANSITION }) }],
);

const createDeferred = (): DeferredValue => {
  let resolve: () => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

const Probe = (): ReactElement => {
  const { t } = useI18n();
  const { brandName } = useTenantSettings();

  return (
    <p>
      {brandName}
      {' | '}
      {t('warehouse.placeholder')}
    </p>
  );
};

const renderGate = async (
  handler: () => Promise<SettingsResponse> | SettingsResponse,
  options: RenderGateOptionsValue = {},
): Promise<RenderedGateValue> => {
  const localizer = await createTestLocalizer();
  const applyOriginal = localizer.applyTenant;
  const applyTenant = vi.spyOn(localizer, 'applyTenant');
  const queryClient = createQueryClient({ networkMode: 'always' });
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(OrganizationService, { getOrganizationSettings: handler });
      options.routes?.(router);
    },
  });

  options.prepare?.({ applyOriginal, applyTenant, queryClient, runtime });

  const tree = (
    <RoutingProvider location={createMemoryLocation(WAREHOUSE_PATH)}>
      <LocalizerProvider localizer={localizer}>
        <ApiRuntimeProvider runtime={runtime}>
          <QueryClientProvider client={queryClient}>
            <TenantSettingsGate localizer={localizer}>
              {options.children ?? <Probe />}
            </TenantSettingsGate>
          </QueryClientProvider>
        </ApiRuntimeProvider>
      </LocalizerProvider>
    </RoutingProvider>
  );

  render(options.isStrict === true ? <StrictMode>{tree}</StrictMode> : tree);

  return { applyOriginal, applyTenant, queryClient, runtime };
};

const ShellProbe = (): ReactElement => {
  const client = useApiClient();
  const session = useSessionQuery();
  const worldClock = useQuery(createWorldClockQueryOptions(client));

  return (
    <p>
      {session.data?.actingOrganizationId}
      {' | '}
      {worldClock.data === undefined ? CLOCK_PENDING_TEXT : CLOCK_READY_TEXT}
    </p>
  );
};

interface ShellRoutesValue {
  getSession: ReturnType<typeof vi.fn>;
  getWorldClock: ReturnType<typeof vi.fn>;
  routes: (router: ConnectRouter) => void;
}

const createShellRoutes = (): ShellRoutesValue => {
  const getSession = vi.fn(() => create(GetSessionResponseSchema, { actingOrganizationId: TEST_ORGANIZATION_ID }));
  const getWorldClock = vi.fn(() => create(GetWorldClockResponseSchema, { timeScale: 1, worldTime: timestampFromMs(Date.now()) }));

  return {
    getSession,
    getWorldClock,
    routes: (router) => {
      router.service(AccessService, { getSession });
      router.service(ClockService, { getWorldClock });
    },
  };
};

const getProbeText = (brandName: string, placeholder: string): string => `${brandName} | ${placeholder}`;

const invalidateSettings = (queryClient: QueryClient): Promise<void> => act(() => queryClient.invalidateQueries());

describe('TenantSettingsGate', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('applies the settings of the organization once and then shows the children', async () => {
    const { applyTenant } = await renderGate(() => createSettingsResponse({ brandName: FIRST_BRAND }));

    expect(await screen.findByText(getProbeText(FIRST_BRAND, defaultLocaleCatalog['warehouse.placeholder']))).toBeDefined();
    expect(applyTenant).toHaveBeenCalledTimes(1);
    expect(applyTenant.mock.calls[0]?.[0]).toMatchObject({
      availableLocales: ['ru'],
      brandName: FIRST_BRAND,
      defaultLocale: 'ru',
      tenantId: ORGANIZATION_ID,
    });
  });

  it('applies each settings value once under StrictMode', async () => {
    const { applyTenant } = await renderGate(
      () => createSettingsResponse({ brandName: FIRST_BRAND, placeholder: FIRST_PLACEHOLDER }),
      { isStrict: true },
    );

    expect(await screen.findByText(getProbeText(FIRST_BRAND, FIRST_PLACEHOLDER))).toBeDefined();
    expect(applyTenant).toHaveBeenCalledTimes(1);
  });

  it('applies settings that are already in the cache once under StrictMode', async () => {
    const fixture: SettingsFixtureValue = { brandName: FIRST_BRAND, placeholder: FIRST_PLACEHOLDER };
    const handler = vi.fn(() => createSettingsResponse(fixture));
    const { applyTenant } = await renderGate(handler, {
      isStrict: true,
      prepare: ({ queryClient }) => {
        queryClient.setQueryData(organizationKeys.settings(TEST_ORGANIZATION_ID), createSettingsResponse(fixture).settings);
      },
    });

    expect(await screen.findByText(getProbeText(FIRST_BRAND, FIRST_PLACEHOLDER))).toBeDefined();
    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });
    await act(() => Promise.resolve());

    expect(applyTenant).toHaveBeenCalledTimes(1);
  });

  it('shows the skeleton of the shell in a busy landmark while the settings are loading', async () => {
    const response = createDeferred();
    const { applyTenant } = await renderGate(async () => {
      await response.promise;

      return createSettingsResponse({ brandName: FIRST_BRAND });
    });

    const waiting = screen.getByRole('main', { busy: true });

    expect(waiting.textContent).toBe(defaultLocaleCatalog['session.loading']);
    expect(waiting.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByTestId('hud-layout-skeleton')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(applyTenant).not.toHaveBeenCalled();

    response.resolve();

    expect(await screen.findByText(getProbeText(FIRST_BRAND, defaultLocaleCatalog['warehouse.placeholder']))).toBeDefined();
    expect(screen.queryByRole('main')).toBeNull();
  });

  it('keeps the children hidden until the tenant is applied', async () => {
    const applying = createDeferred();
    const { applyTenant } = await renderGate(
      () => createSettingsResponse({ brandName: FIRST_BRAND, placeholder: FIRST_PLACEHOLDER }),
      {
        prepare: ({ applyOriginal, applyTenant: spy }) => {
          spy.mockImplementationOnce(async (tenant) => {
            await applying.promise;
            await applyOriginal(tenant);
          });
        },
      },
    );

    await waitFor(() => {
      expect(applyTenant).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('main', { busy: true })).toBeDefined();
    expect(screen.queryByText(/\|/)).toBeNull();

    applying.resolve();

    expect(await screen.findByText(getProbeText(FIRST_BRAND, FIRST_PLACEHOLDER))).toBeDefined();
    expect(screen.queryByText(defaultLocaleCatalog['warehouse.placeholder'])).toBeNull();
  });

  it('replaces the term of the interface with the override from the response', async () => {
    await renderGate(() => createSettingsResponse({ brandName: FIRST_BRAND, placeholder: FIRST_PLACEHOLDER }));

    expect(await screen.findByText(getProbeText(FIRST_BRAND, FIRST_PLACEHOLDER))).toBeDefined();
    expect(screen.queryByText(defaultLocaleCatalog['warehouse.placeholder'])).toBeNull();
  });

  it('applies new settings again and keeps the previous children on screen while they are applied', async () => {
    let currentFixture: SettingsFixtureValue = { brandName: FIRST_BRAND, placeholder: FIRST_PLACEHOLDER };
    const { applyOriginal, applyTenant, queryClient } = await renderGate(() => createSettingsResponse(currentFixture));

    await screen.findByText(getProbeText(FIRST_BRAND, FIRST_PLACEHOLDER));

    const applying = createDeferred();
    applyTenant.mockImplementationOnce(async (tenant) => {
      await applying.promise;
      await applyOriginal(tenant);
    });
    currentFixture = { brandName: SECOND_BRAND, placeholder: SECOND_PLACEHOLDER };

    await invalidateSettings(queryClient);
    await waitFor(() => {
      expect(applyTenant).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText(getProbeText(FIRST_BRAND, FIRST_PLACEHOLDER))).toBeDefined();
    expect(screen.queryByRole('main')).toBeNull();

    applying.resolve();

    expect(await screen.findByText(getProbeText(SECOND_BRAND, SECOND_PLACEHOLDER))).toBeDefined();
    expect(applyTenant).toHaveBeenCalledTimes(2);
  });

  it('does not apply the same settings twice when the response is unchanged', async () => {
    const { applyTenant, queryClient } = await renderGate(
      () => createSettingsResponse({ brandName: FIRST_BRAND, placeholder: FIRST_PLACEHOLDER }),
    );

    await screen.findByText(getProbeText(FIRST_BRAND, FIRST_PLACEHOLDER));
    await invalidateSettings(queryClient);

    expect(applyTenant).toHaveBeenCalledTimes(1);
  });

  it('ignores the late result of outdated settings', async () => {
    let currentFixture: SettingsFixtureValue = { brandName: FIRST_BRAND, placeholder: FIRST_PLACEHOLDER };
    const outdated = createDeferred();
    const { applyTenant, queryClient } = await renderGate(() => createSettingsResponse(currentFixture), {
      prepare: ({ applyTenant: spy }) => {
        spy.mockImplementationOnce(() => outdated.promise);
      },
    });

    await waitFor(() => {
      expect(applyTenant).toHaveBeenCalledTimes(1);
    });

    currentFixture = { brandName: SECOND_BRAND, placeholder: SECOND_PLACEHOLDER };
    await invalidateSettings(queryClient);

    expect(await screen.findByText(getProbeText(SECOND_BRAND, SECOND_PLACEHOLDER))).toBeDefined();

    await act(async () => {
      outdated.resolve();
      await outdated.promise;
    });

    expect(screen.getByText(getProbeText(SECOND_BRAND, SECOND_PLACEHOLDER))).toBeDefined();
    expect(screen.queryByText(getProbeText(FIRST_BRAND, FIRST_PLACEHOLDER))).toBeNull();
  });

  it('shows the start error screen when the request fails and refetches on retry', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let isFailing = true;
    const { applyTenant } = await renderGate(() => {
      if (isFailing) {
        return Promise.reject(createSettingsError());
      }

      return createSettingsResponse({ brandName: FIRST_BRAND });
    });

    expect((await screen.findByRole('alert')).textContent).toBe(defaultLocaleCatalog['app.startError.message']);
    expect(applyTenant).not.toHaveBeenCalled();

    isFailing = false;
    fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    expect(await screen.findByText(getProbeText(FIRST_BRAND, defaultLocaleCatalog['warehouse.placeholder']))).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(applyTenant).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('keeps the start error screen while the retry request is running', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let attempt = 0;
    const retryResponse = createDeferred();
    await renderGate(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw createSettingsError();
      }
      await retryResponse.promise;

      return createSettingsResponse({ brandName: FIRST_BRAND });
    });

    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button'));

    const retryingButton = await screen.findByRole('button', { name: defaultLocaleCatalog['common.retrying'] });

    expect(retryingButton.getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('main', { busy: true })).toBeNull();

    retryResponse.resolve();

    expect(await screen.findByText(getProbeText(FIRST_BRAND, defaultLocaleCatalog['warehouse.placeholder']))).toBeDefined();
  });

  it('logs a failed application of the tenant and applies it again on retry', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { applyTenant } = await renderGate(
      () => createSettingsResponse({ brandName: FIRST_BRAND, placeholder: FIRST_PLACEHOLDER }),
      {
        prepare: ({ applyTenant: spy }) => {
          spy.mockRejectedValueOnce(new Error('catalog chunk is unavailable'));
        },
      },
    );

    expect((await screen.findByRole('alert')).textContent).toBe(defaultLocaleCatalog['app.startError.message']);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[0]).toBe('> TenantSettingsGate -> applyTenant:');
    expect(applyTenant).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    expect(await screen.findByText(getProbeText(FIRST_BRAND, FIRST_PLACEHOLDER))).toBeDefined();
    expect(applyTenant).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('requests the session and the world clock while the settings are still loading and hands them to the children', async () => {
    const response = createDeferred();
    const shell = createShellRoutes();
    await renderGate(async () => {
      await response.promise;

      return createSettingsResponse({ brandName: FIRST_BRAND });
    }, { children: <ShellProbe />, routes: shell.routes });

    await waitFor(() => {
      expect(shell.getSession).toHaveBeenCalledTimes(1);
      expect(shell.getWorldClock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('main', { busy: true })).toBeDefined();

    response.resolve();

    expect(await screen.findByText(`${TEST_ORGANIZATION_ID} | clock`)).toBeDefined();
    expect(shell.getSession).toHaveBeenCalledTimes(1);
    expect(shell.getWorldClock).toHaveBeenCalledTimes(1);
  });

  it('requests each shell query once under StrictMode', async () => {
    const shell = createShellRoutes();
    await renderGate(() => createSettingsResponse({ brandName: FIRST_BRAND }), {
      children: <ShellProbe />,
      isStrict: true,
      routes: shell.routes,
    });

    expect(await screen.findByText(`${TEST_ORGANIZATION_ID} | clock`)).toBeDefined();
    expect(shell.getSession).toHaveBeenCalledTimes(1);
    expect(shell.getWorldClock).toHaveBeenCalledTimes(1);
  });

  it('does not request the session while the acting user is unknown but still requests the world clock', async () => {
    const shell = createShellRoutes();
    await renderGate(() => createSettingsResponse({ brandName: FIRST_BRAND }), {
      children: <ShellProbe />,
      prepare: ({ runtime }) => {
        runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: undefined });
      },
      routes: shell.routes,
    });

    expect(await screen.findByText('| clock')).toBeDefined();
    expect(shell.getSession).not.toHaveBeenCalled();
    expect(shell.getWorldClock).toHaveBeenCalledTimes(1);
  });

  it('requests the session again when the acting user changes', async () => {
    const shell = createShellRoutes();
    const { runtime } = await renderGate(() => createSettingsResponse({ brandName: FIRST_BRAND }), {
      children: <ShellProbe />,
      routes: shell.routes,
    });

    await screen.findByText(`${TEST_ORGANIZATION_ID} | clock`);

    act(() => {
      runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: OTHER_USER_ID });
    });

    await waitFor(() => {
      expect(shell.getSession).toHaveBeenCalledTimes(2);
    });

    expect(shell.getWorldClock).toHaveBeenCalledTimes(1);
  });
});
