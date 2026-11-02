import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  type ListShowcaseListingsRequest,
  type ListShowcaseListingsResponse,
  ListShowcaseListingsResponseSchema,
  ShowcaseListingSchema,
  ShowcaseService,
} from '@skladburg/contracts/catalog/v1/showcase';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
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

import type { ShowcaseListParamsValue } from './listingTypes';

import { listingKeys } from './listingKeys';
import { useShowcaseListingsQuery } from './useShowcaseListingsQuery';

const PARAMS: ShowcaseListParamsValue = { query: 'яблоки', sphereId: '', toWarehouseId: '' };

const createListingsResponse = (
  ids: readonly string[],
  nextPageToken: string,
): ListShowcaseListingsResponse => create(ListShowcaseListingsResponseSchema, {
  listings: ids.map(id => create(ShowcaseListingSchema, { id })),
  page: { nextPageToken },
});

describe('useShowcaseListingsQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not request the showcase without an acting organization', () => {
    const listShowcaseListings = vi.fn((): ListShowcaseListingsResponse => createListingsResponse([], ''));
    const runtime = createTestRuntime({
      routes: router => router.service(ShowcaseService, { listShowcaseListings }),
    });
    runtime.actingContext.set({ organizationId: undefined, userId: runtime.actingContext.get().userId });
    const queryClient: QueryClient = createQueryClient({ networkMode: 'always' });

    const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiRuntimeProvider>
    );

    const { result } = renderHook(() => useShowcaseListingsQuery(PARAMS), { wrapper: Wrapper });

    expect(listShowcaseListings).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('loads the pages of 30 on demand, passes the filters and declares the market channel', async () => {
    const listShowcaseListings = vi.fn((request: ListShowcaseListingsRequest): ListShowcaseListingsResponse => (
      request.page?.pageToken === 'second'
        ? createListingsResponse(['listing-3'], '')
        : createListingsResponse(['listing-1', 'listing-2'], 'second')
    ));
    const runtime = createTestRuntime({
      routes: router => router.service(ShowcaseService, { listShowcaseListings }),
    });
    const queryClient: QueryClient = createQueryClient({ networkMode: 'always' });

    const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiRuntimeProvider>
    );

    const { result } = renderHook(() => useShowcaseListingsQuery(PARAMS), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({
      exact: true,
      queryKey: listingKeys.showcase(TEST_ORGANIZATION_ID, PARAMS),
    });

    expect(query?.meta).toEqual({ channels: ['market'], eventCases: ['listingsChanged'] });
    expect(result.current.hasNextPage).toBe(true);
    expect(listShowcaseListings).toHaveBeenCalledTimes(1);
    expect(listShowcaseListings.mock.calls[0]?.[0].page?.pageSize).toBe(30);
    expect(listShowcaseListings.mock.calls[0]?.[0].query).toBe('яблоки');

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(false);
    });

    expect(result.current.data?.pages.flatMap(page => page.items.map(item => item.id))).toEqual(['listing-1', 'listing-2', 'listing-3']);
    expect(listShowcaseListings).toHaveBeenCalledTimes(2);
  });
});
