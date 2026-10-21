import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  type ListMapSitesRequest,
  type ListMapSitesResponse,
  ListMapSitesResponseSchema,
  MapSiteSchema,
  NetworkService,
} from '@skladburg/contracts/network/v1/network';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
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

import { networkKeys } from './networkKeys';
import { useMapSitesQuery } from './useMapSitesQuery';

const createSiteResponse = (ids: readonly string[], nextPageToken: string): ListMapSitesResponse => create(ListMapSitesResponseSchema, {
  mapSites: ids.map(id => create(MapSiteSchema, { id })),
  page: { nextPageToken },
});

describe('useMapSitesQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not request map sites without an acting organization', () => {
    const listMapSites = vi.fn((): ListMapSitesResponse => createSiteResponse([], ''));
    const runtime = createTestRuntime({
      routes: router => router.service(NetworkService, { listMapSites }),
    });
    runtime.actingContext.set({ organizationId: undefined, userId: undefined });
    const queryClient: QueryClient = createQueryClient({ networkMode: 'always' });

    const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiRuntimeProvider>
    );

    const { result } = renderHook(useMapSitesQuery, { wrapper: Wrapper });
    const query = queryClient.getQueryCache().find({ exact: true, queryKey: networkKeys.mapSites('none') });

    expect(listMapSites).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(query?.meta).toEqual({ channels: [] });
  });

  it('stores all pages under the organization key and declares the organization channel', async () => {
    const listMapSites = vi.fn((request: ListMapSitesRequest): ListMapSitesResponse => (
      request.page?.pageToken === 'second'
        ? createSiteResponse(['site-3'], '')
        : createSiteResponse(['site-1', 'site-2'], 'second')
    ));
    const runtime = createTestRuntime({
      routes: router => router.service(NetworkService, { listMapSites }),
    });
    const queryClient: QueryClient = createQueryClient({ networkMode: 'always' });

    const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiRuntimeProvider>
    );

    const { result } = renderHook(useMapSitesQuery, { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: networkKeys.mapSites(TEST_ORGANIZATION_ID) });

    expect(query?.meta).toEqual({ channels: [`org:${TEST_ORGANIZATION_ID}`] });
    expect(result.current.data?.map(site => site.id)).toEqual(['site-1', 'site-2', 'site-3']);
    expect(listMapSites).toHaveBeenCalledTimes(2);
    expect(listMapSites.mock.calls[0]?.[0].page?.pageSize).toBe(200);
  });
});
