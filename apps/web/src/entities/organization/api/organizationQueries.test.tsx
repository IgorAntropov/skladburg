import type { Organization } from '@skladburg/contracts/organization/v1/organization';
import type { QueryClient } from '@tanstack/react-query';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  GetOrganizationResponseSchema,
  GetOrganizationSettingsResponseSchema,
  OrganizationSchema,
  OrganizationService,
  OrganizationSettingsSchema,
} from '@skladburg/contracts/organization/v1/organization';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ApiRuntimeValue } from '@/shared/api';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from '@/shared/api/index.testing';

import { organizationKeys } from './organizationKeys';
import { useActingOrganizationQuery } from './useActingOrganizationQuery';
import { useOrganizationSettingsQuery } from './useOrganizationSettingsQuery';

const OTHER_ORGANIZATION_ID = 'f1000002-0000-4000-8000-000000000000';

const createOrganization = (id: string): Organization => create(OrganizationSchema, {
  id,
  legalName: 'ООО «Северный склад»',
  name: 'Северный склад',
});

interface RenderedQueryValue<Result extends object> {
  queryClient: QueryClient;
  result: { current: Result };
  runtime: ApiRuntimeValue;
}

const renderQueryHook = <Result extends object>(
  runtime: ApiRuntimeValue,
  useHook: () => Result,
): RenderedQueryValue<Result> => {
  const queryClient = createQueryClient({ networkMode: 'always' });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  const { result } = renderHook(useHook, { wrapper: Wrapper });

  return { queryClient, result, runtime };
};

describe('useActingOrganizationQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('requests the acting organization and returns it', async () => {
    const getOrganization = vi.fn((request: { organizationId: string }) => create(GetOrganizationResponseSchema, {
      organization: createOrganization(request.organizationId),
    }));
    const runtime = createTestRuntime({ routes: router => router.service(OrganizationService, { getOrganization }) });

    const { result } = renderQueryHook(runtime, useActingOrganizationQuery);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe(TEST_ORGANIZATION_ID);
    expect(result.current.data?.legalName).toBe('ООО «Северный склад»');
    expect(getOrganization).toHaveBeenCalledTimes(1);
    expect(getOrganization.mock.calls[0]?.[0].organizationId).toBe(TEST_ORGANIZATION_ID);
  });

  it('stores the data under the detail key and declares the organization channel', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationService, {
        getOrganization: request => create(GetOrganizationResponseSchema, { organization: createOrganization(request.organizationId) }),
      }),
    });

    const { queryClient, result } = renderQueryHook(runtime, useActingOrganizationQuery);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: organizationKeys.detail(TEST_ORGANIZATION_ID) });

    expect(query?.state.data).toBe(result.current.data);
    expect(query?.meta).toEqual({ channels: [`org:${TEST_ORGANIZATION_ID}`] });
  });

  it('sends the acting organization header', async () => {
    const headers: (null | string)[] = [];
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationService, {
        getOrganization: (request, context) => {
          headers.push(context.requestHeader.get(ACTING_ORGANIZATION_HEADER));

          return create(GetOrganizationResponseSchema, { organization: createOrganization(request.organizationId) });
        },
      }),
    });

    const { result } = renderQueryHook(runtime, useActingOrganizationQuery);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(headers).toEqual([TEST_ORGANIZATION_ID]);
  });

  it('fails when the response has no organization', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationService, {
        getOrganization: () => create(GetOrganizationResponseSchema),
      }),
    });

    const { result } = renderQueryHook(runtime, useActingOrganizationQuery);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });

  it('does not request anything while there is no acting organization', async () => {
    const getOrganization = vi.fn(() => create(GetOrganizationResponseSchema));
    const runtime = createTestRuntime({ routes: router => router.service(OrganizationService, { getOrganization }) });

    runtime.actingContext.set({ organizationId: undefined, userId: TEST_USER_ID });

    const { queryClient, result } = renderQueryHook(runtime, useActingOrganizationQuery);

    await Promise.resolve();

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isPending).toBe(true);
    expect(getOrganization).not.toHaveBeenCalled();

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: organizationKeys.detail('none') });

    expect(query?.meta).toEqual({ channels: [] });
  });

  it('requests the new organization when the acting context changes', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationService, {
        getOrganization: request => create(GetOrganizationResponseSchema, { organization: createOrganization(request.organizationId) }),
      }),
    });

    const { result } = renderQueryHook(runtime, useActingOrganizationQuery);

    await waitFor(() => {
      expect(result.current.data?.id).toBe(TEST_ORGANIZATION_ID);
    });

    act(() => {
      runtime.actingContext.set({ organizationId: OTHER_ORGANIZATION_ID, userId: TEST_USER_ID });
    });

    await waitFor(() => {
      expect(result.current.data?.id).toBe(OTHER_ORGANIZATION_ID);
    });
  });
});

describe('useOrganizationSettingsQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('requests the settings of the acting organization and returns them', async () => {
    const getOrganizationSettings = vi.fn(() => create(GetOrganizationSettingsResponseSchema, {
      settings: create(OrganizationSettingsSchema, {
        availableLocales: ['ru'],
        brandName: 'Северный склад',
        defaultLocale: 'ru',
        organizationId: TEST_ORGANIZATION_ID,
      }),
    }));
    const runtime = createTestRuntime({ routes: router => router.service(OrganizationService, { getOrganizationSettings }) });

    const { result } = renderQueryHook(runtime, useOrganizationSettingsQuery);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.brandName).toBe('Северный склад');
    expect(result.current.data?.organizationId).toBe(TEST_ORGANIZATION_ID);
    expect(getOrganizationSettings).toHaveBeenCalledTimes(1);
  });

  it('stores the data under the settings key and declares the organization channel', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationService, {
        getOrganizationSettings: () => create(GetOrganizationSettingsResponseSchema, {
          settings: create(OrganizationSettingsSchema, { organizationId: TEST_ORGANIZATION_ID }),
        }),
      }),
    });

    const { queryClient, result } = renderQueryHook(runtime, useOrganizationSettingsQuery);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: organizationKeys.settings(TEST_ORGANIZATION_ID) });

    expect(query?.state.data).toBe(result.current.data);
    expect(query?.meta).toEqual({ channels: [`org:${TEST_ORGANIZATION_ID}`] });
  });

  it('sends the acting organization header', async () => {
    const headers: (null | string)[] = [];
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationService, {
        getOrganizationSettings: (_request, context) => {
          headers.push(context.requestHeader.get(ACTING_ORGANIZATION_HEADER));

          return create(GetOrganizationSettingsResponseSchema, {
            settings: create(OrganizationSettingsSchema, { organizationId: TEST_ORGANIZATION_ID }),
          });
        },
      }),
    });

    const { result } = renderQueryHook(runtime, useOrganizationSettingsQuery);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(headers).toEqual([TEST_ORGANIZATION_ID]);
  });

  it('fails when the response has no settings', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationService, {
        getOrganizationSettings: () => create(GetOrganizationSettingsResponseSchema),
      }),
    });

    const { result } = renderQueryHook(runtime, useOrganizationSettingsQuery);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });

  it('does not request anything while there is no acting organization', async () => {
    const getOrganizationSettings = vi.fn(() => create(GetOrganizationSettingsResponseSchema));
    const runtime = createTestRuntime({ routes: router => router.service(OrganizationService, { getOrganizationSettings }) });

    runtime.actingContext.set({ organizationId: undefined, userId: TEST_USER_ID });

    const { queryClient, result } = renderQueryHook(runtime, useOrganizationSettingsQuery);

    await Promise.resolve();

    expect(result.current.fetchStatus).toBe('idle');
    expect(getOrganizationSettings).not.toHaveBeenCalled();

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: organizationKeys.settings('none') });

    expect(query?.meta).toEqual({ channels: [] });
  });
});
