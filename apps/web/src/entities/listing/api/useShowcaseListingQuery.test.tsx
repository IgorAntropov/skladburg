import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  type GetShowcaseListingRequest,
  type GetShowcaseListingResponse,
  GetShowcaseListingResponseSchema,
  ShowcaseListingSchema,
  ShowcaseService,
} from '@skladburg/contracts/catalog/v1/showcase';
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

import { listingKeys } from './listingKeys';
import { useShowcaseListingQuery } from './useShowcaseListingQuery';

const LISTING_ID = '00000000-0000-4000-8000-000000000011';
const WAREHOUSE_ID = '00000000-0000-4000-8000-000000000022';

const createRuntimeWrapper = (
  getShowcaseListing: (request: GetShowcaseListingRequest) => GetShowcaseListingResponse,
): { queryClient: QueryClient; Wrapper: (props: { children: ReactNode }) => ReactElement } => {
  const runtime = createTestRuntime({
    routes: router => router.service(ShowcaseService, { getShowcaseListing }),
  });
  const queryClient: QueryClient = createQueryClient({ networkMode: 'always' });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  return { queryClient, Wrapper };
};

describe('useShowcaseListingQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not request the listing without a listing id', () => {
    const getShowcaseListing = vi.fn((): GetShowcaseListingResponse => create(GetShowcaseListingResponseSchema));
    const { Wrapper } = createRuntimeWrapper(getShowcaseListing);

    const { result } = renderHook(() => useShowcaseListingQuery(undefined, WAREHOUSE_ID), { wrapper: Wrapper });

    expect(getShowcaseListing).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('asks for the listing with the destination warehouse and declares the market channel', async () => {
    const getShowcaseListing = vi.fn((request: GetShowcaseListingRequest): GetShowcaseListingResponse => create(
      GetShowcaseListingResponseSchema,
      { listing: create(ShowcaseListingSchema, { id: request.listingId }) },
    ));
    const { queryClient, Wrapper } = createRuntimeWrapper(getShowcaseListing);

    const { result } = renderHook(() => useShowcaseListingQuery(LISTING_ID, WAREHOUSE_ID), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({
      exact: true,
      queryKey: listingKeys.showcaseItem(TEST_ORGANIZATION_ID, LISTING_ID, WAREHOUSE_ID),
    });

    expect(query?.meta).toEqual({ channels: ['market'], eventCases: ['listingsChanged'] });
    expect(getShowcaseListing.mock.calls[0]?.[0].listingId).toBe(LISTING_ID);
    expect(getShowcaseListing.mock.calls[0]?.[0].toWarehouseId).toBe(WAREHOUSE_ID);
    expect(result.current.data?.id).toBe(LISTING_ID);
  });
});
