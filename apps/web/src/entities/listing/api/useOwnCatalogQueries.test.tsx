import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  CatalogService,
  type GetOwnListingResponse,
  GetOwnListingResponseSchema,
  ListingPriceSchema,
  ListingSchema,
  type ListListingPricesRequest,
  type ListListingPricesResponse,
  ListListingPricesResponseSchema,
  type ListOwnListingsRequest,
  type ListOwnListingsResponse,
  ListOwnListingsResponseSchema,
  OwnListingSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { organizationChannel } from '@skladburg/contracts/runtime';
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

import type { TestRuntimeOptionsValue } from '@/shared/api/index.testing';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';

import { listingKeys } from './listingKeys';
import { useListingPricesQuery } from './useListingPricesQuery';
import { useOwnListingQuery } from './useOwnListingQuery';
import { useOwnListingsQuery } from './useOwnListingsQuery';

const FIRST_LISTING_ID = '00000000-0000-4000-8000-000000000011';
const SECOND_LISTING_ID = '00000000-0000-4000-8000-000000000012';

const OWN_EVENT_META = { channels: [organizationChannel(TEST_ORGANIZATION_ID)], eventCases: ['listingsChanged'] };

const createWrapper = (
  routes: TestRuntimeOptionsValue['routes'],
): { queryClient: QueryClient; Wrapper: (props: { children: ReactNode }) => ReactElement } => {
  const runtime = createTestRuntime({ routes });
  const queryClient: QueryClient = createQueryClient({ networkMode: 'always' });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  return { queryClient, Wrapper };
};

describe('useListingPricesQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not ask for prices without listing ids because the service answers an empty list with every price', () => {
    const listListingPrices = vi.fn((): ListListingPricesResponse => create(ListListingPricesResponseSchema));
    const { Wrapper } = createWrapper(router => router.service(CatalogService, { listListingPrices }));

    const { result } = renderHook(() => useListingPricesQuery([]), { wrapper: Wrapper });

    expect(listListingPrices).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('collects the pages for the listing ids and indexes the prices by listing', async () => {
    const listListingPrices = vi.fn((request: ListListingPricesRequest): ListListingPricesResponse => (
      request.page?.pageToken === 'second'
        ? create(ListListingPricesResponseSchema, { prices: [create(ListingPriceSchema, { listingId: SECOND_LISTING_ID })] })
        : create(ListListingPricesResponseSchema, {
            page: { nextPageToken: 'second' },
            prices: [create(ListingPriceSchema, { listingId: FIRST_LISTING_ID })],
          })
    ));
    const listingIds = [FIRST_LISTING_ID, SECOND_LISTING_ID];
    const { queryClient, Wrapper } = createWrapper(router => router.service(CatalogService, { listListingPrices }));

    const { result } = renderHook(() => useListingPricesQuery(listingIds), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({
      exact: true,
      queryKey: listingKeys.prices(TEST_ORGANIZATION_ID, listingIds),
    });

    expect(query?.meta).toEqual(OWN_EVENT_META);
    expect(listListingPrices).toHaveBeenCalledTimes(2);
    expect(listListingPrices.mock.calls[0]?.[0].listingIds).toEqual(listingIds);
    expect([...(result.current.data?.keys() ?? [])]).toEqual([FIRST_LISTING_ID, SECOND_LISTING_ID]);
  });
});

describe('useOwnListingsQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('loads the pages of 30 on demand and declares the organization channel', async () => {
    const toPair = (id: string): ListOwnListingsResponse['listings'][number] => (
      create(OwnListingSchema, { listing: create(ListingSchema, { id }) })
    );
    const listOwnListings = vi.fn((request: ListOwnListingsRequest): ListOwnListingsResponse => (
      request.page?.pageToken === 'second'
        ? create(ListOwnListingsResponseSchema, { listings: [toPair('listing-3')] })
        : create(ListOwnListingsResponseSchema, { listings: [toPair('listing-1'), toPair('listing-2')], page: { nextPageToken: 'second' } })
    ));
    const { queryClient, Wrapper } = createWrapper(router => router.service(CatalogService, { listOwnListings }));

    const { result } = renderHook(() => useOwnListingsQuery(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: listingKeys.own(TEST_ORGANIZATION_ID, '') });

    expect(query?.meta).toEqual(OWN_EVENT_META);
    expect(listOwnListings.mock.calls[0]?.[0].page?.pageSize).toBe(30);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(false);
    });

    expect(result.current.data?.pages.flatMap(page => page.items.map(item => item.listing?.id)))
      .toEqual(['listing-1', 'listing-2', 'listing-3']);
  });
});

describe('useOwnListingQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not request a listing without an id', () => {
    const getOwnListing = vi.fn((): GetOwnListingResponse => create(GetOwnListingResponseSchema));
    const { Wrapper } = createWrapper(router => router.service(CatalogService, { getOwnListing }));

    const { result } = renderHook(() => useOwnListingQuery(undefined), { wrapper: Wrapper });

    expect(getOwnListing).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('reads the listing of the organization by id and keeps it under the item key', async () => {
    const getOwnListing = vi.fn((): GetOwnListingResponse => create(GetOwnListingResponseSchema, {
      listing: create(OwnListingSchema, { listing: create(ListingSchema, { id: FIRST_LISTING_ID }) }),
    }));
    const { queryClient, Wrapper } = createWrapper(router => router.service(CatalogService, { getOwnListing }));

    const { result } = renderHook(() => useOwnListingQuery(FIRST_LISTING_ID), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({
      exact: true,
      queryKey: listingKeys.ownItem(TEST_ORGANIZATION_ID, FIRST_LISTING_ID),
    });

    expect(query?.meta).toEqual(OWN_EVENT_META);
    expect(result.current.data?.listing?.id).toBe(FIRST_LISTING_ID);
  });
});
