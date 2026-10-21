import type {
  ListCitiesResponse,
  ListMapNodesResponse,
  ListMapSitesResponse,
  ListRouteLegsResponse,
} from '@skladburg/contracts/network/v1/network';
import type { RenderHookResult } from '@testing-library/react';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  CitySchema,
  ListCitiesResponseSchema,
  ListMapNodesResponseSchema,
  ListMapSitesResponseSchema,
  ListRouteLegsResponseSchema,
  MapNodeSchema,
  MapSiteSchema,
  NetworkService,
} from '@skladburg/contracts/network/v1/network';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
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

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';
import { LocalizerProvider } from '@/shared/i18n';
import { createTestLocalizer } from '@/shared/i18n/index.testing';

import type { NetworkMapModelStateValue } from './useNetworkMapModel';

import { useNetworkMapModel } from './useNetworkMapModel';

const OTHER_ORGANIZATION_ID = 'f0000009-0000-4000-8000-000000000000';

const createDirectoryRoutes = (): {
  listCities: () => ListCitiesResponse;
  listMapNodes: () => ListMapNodesResponse;
  listRouteLegs: () => ListRouteLegsResponse;
} => ({
  listCities: () => create(ListCitiesResponseSchema, {
    cities: [create(CitySchema, { id: 'city-1', name: 'Север', timeZone: 'Europe/Moscow' })],
  }),
  listMapNodes: () => create(ListMapNodesResponseSchema, { mapNodes: [create(MapNodeSchema, { cityId: 'city-1', id: 'node-1' })] }),
  listRouteLegs: () => create(ListRouteLegsResponseSchema, {}),
});

const createSitesResponse = (organizationId: string): ListMapSitesResponse => create(ListMapSitesResponseSchema, {
  mapSites: [
    create(MapSiteSchema, {
      id: `site-of-${organizationId}`,
      mapNodeId: 'node-1',
      name: 'Склад',
      organizationId,
      organizationName: 'Организация',
      profileKind: ProfileKind.CUSTOMER,
    }),
  ],
});

const createFailure = (): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{
    desc: ErrorDetailSchema,
    value: create(ErrorDetailSchema, { code: ErrorCode.PERMISSION_DENIED, params: { case: undefined } }),
  }],
);

const renderModelHook = async (
  runtime: ReturnType<typeof createTestRuntime>,
): Promise<RenderHookResult<NetworkMapModelStateValue, undefined>> => {
  const localizer = await createTestLocalizer();
  const queryClient = createQueryClient({ networkMode: 'always' });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <LocalizerProvider localizer={localizer}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </LocalizerProvider>
    </ApiRuntimeProvider>
  );

  return renderHook(useNetworkMapModel, { wrapper: Wrapper });
};

describe('useNetworkMapModel', () => {
  afterEach(() => {
    cleanup();
  });

  it('builds the model once both requests are ready', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(NetworkService, {
        ...createDirectoryRoutes(),
        listMapSites: () => createSitesResponse(TEST_ORGANIZATION_ID),
      }),
    });

    const { result } = await renderModelHook(runtime);

    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data?.cities.map(city => city.name)).toEqual(['Север']);
    expect(result.current.data?.sites.map(site => [site.id, site.isOwn])).toEqual([[`site-of-${TEST_ORGANIZATION_ID}`, true]]);
  });

  it('reports the failure and retries only the failed request', async () => {
    const listCities = vi.fn(createDirectoryRoutes().listCities);
    let isSitesFailing = true;
    const listMapSites = vi.fn((): ListMapSitesResponse => {
      if (isSitesFailing) {
        throw createFailure();
      }

      return createSitesResponse(TEST_ORGANIZATION_ID);
    });
    const runtime = createTestRuntime({
      routes: router => router.service(NetworkService, {
        ...createDirectoryRoutes(),
        listCities,
        listMapSites,
      }),
    });

    const { result } = await renderModelHook(runtime);

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.data).toBeUndefined();
    expect(listCities).toHaveBeenCalledTimes(1);
    expect(listMapSites).toHaveBeenCalledTimes(1);

    isSitesFailing = false;

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    await waitFor(() => {
      expect(result.current.isRetrying).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(listCities).toHaveBeenCalledTimes(1);
    expect(listMapSites).toHaveBeenCalledTimes(2);
  });

  it('does nothing on retry when nothing has failed', async () => {
    const listMapSites = vi.fn((): ListMapSitesResponse => createSitesResponse(TEST_ORGANIZATION_ID));
    const runtime = createTestRuntime({
      routes: router => router.service(NetworkService, { ...createDirectoryRoutes(), listMapSites }),
    });

    const { result } = await renderModelHook(runtime);

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    act(() => {
      result.current.retry();
    });

    expect(result.current.isRetrying).toBe(false);
    expect(listMapSites).toHaveBeenCalledTimes(1);
  });

  it('requests the sites again under a new key when the organization changes', async () => {
    const listMapSites = vi.fn((): ListMapSitesResponse => createSitesResponse(
      runtimeOrganizationId(),
    ));
    const runtime = createTestRuntime({
      routes: router => router.service(NetworkService, { ...createDirectoryRoutes(), listMapSites }),
    });
    const runtimeOrganizationId = (): string => runtime.actingContext.get().organizationId ?? '';

    const { result } = await renderModelHook(runtime);

    await waitFor(() => {
      expect(result.current.data?.sites[0]?.id).toBe(`site-of-${TEST_ORGANIZATION_ID}`);
    });

    act(() => {
      runtime.actingContext.set({ organizationId: OTHER_ORGANIZATION_ID, userId: undefined });
    });

    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.data?.sites[0]?.id).toBe(`site-of-${OTHER_ORGANIZATION_ID}`);
    });

    expect(result.current.data?.sites[0]?.isOwn).toBe(true);
    expect(listMapSites).toHaveBeenCalledTimes(2);
  });
});
