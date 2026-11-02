import {
  type QueryClient,
  QueryObserver,
} from '@tanstack/react-query';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  ApiQueryMetaValue,
  RealtimeEventCaseValue,
} from './apiQueryMetaTypes';

import { createQueryClient } from './createQueryClient';
import { invalidateQueriesByChannel } from './invalidateQueriesByChannel';

const ORGANIZATION_CHANNEL = 'org:11111111-1111-4111-8111-111111111111';
const DEAL_CHANNEL = 'deal:22222222-2222-4222-8222-222222222222';

const WAREHOUSE_EVENTS: ReadonlySet<RealtimeEventCaseValue> = new Set(['warehouseCreated']);

describe('invalidateQueriesByChannel', () => {
  let queryClient: QueryClient;
  let stops: (() => void)[];

  const observe = (
    queryKey: readonly string[],
    meta: ApiQueryMetaValue | undefined,
  ): ReturnType<typeof vi.fn<() => Promise<string>>> => {
    const queryFn = vi.fn<() => Promise<string>>(() => Promise.resolve('data'));
    const observer = new QueryObserver(queryClient, {
      meta,
      queryFn,
      queryKey,
      staleTime: Infinity,
    });

    stops.push(observer.subscribe(() => undefined));

    return queryFn;
  };

  const waitForQuery = async (queryKey: readonly string[]): Promise<void> => {
    await vi.waitFor(() => {
      expect(queryClient.getQueryState(queryKey)?.status).toBe('success');
    });
  };

  beforeEach(() => {
    queryClient = createQueryClient({ networkMode: 'always' });
    stops = [];
  });

  afterEach(() => {
    stops.forEach((stop) => {
      stop();
    });
    queryClient.clear();
  });

  it('refetches only queries that declare the channel', async () => {
    const organizationQuery = observe(['warehouses'], { channels: [ORGANIZATION_CHANNEL] });
    const multiChannelQuery = observe(['dashboard'], { channels: [DEAL_CHANNEL, ORGANIZATION_CHANNEL] });
    const dealQuery = observe(['deal'], { channels: [DEAL_CHANNEL] });
    const queryWithoutMeta = observe(['plain'], undefined);
    const queryWithoutChannels = observe(['empty'], { channels: [] });

    await waitForQuery(['plain']);

    await invalidateQueriesByChannel(queryClient, ORGANIZATION_CHANNEL, undefined);

    expect(organizationQuery).toHaveBeenCalledTimes(2);
    expect(multiChannelQuery).toHaveBeenCalledTimes(2);
    expect(dealQuery).toHaveBeenCalledTimes(1);
    expect(queryWithoutMeta).toHaveBeenCalledTimes(1);
    expect(queryWithoutChannels).toHaveBeenCalledTimes(1);
  });

  it('refetches a query of the channel only for the event cases it waits for', async () => {
    const warehousesQuery = observe(['warehouses'], {
      channels: [ORGANIZATION_CHANNEL],
      eventCases: ['warehouseChanged', 'warehouseCreated'],
    });
    const listingsQuery = observe(['listings'], { channels: [ORGANIZATION_CHANNEL], eventCases: ['listingsChanged'] });
    const quietQuery = observe(['quiet'], { channels: [ORGANIZATION_CHANNEL], eventCases: [] });
    const unfilteredQuery = observe(['organization'], { channels: [ORGANIZATION_CHANNEL] });
    const dealQuery = observe(['deal'], { channels: [DEAL_CHANNEL], eventCases: ['warehouseCreated'] });

    await waitForQuery(['deal']);

    await invalidateQueriesByChannel(queryClient, ORGANIZATION_CHANNEL, WAREHOUSE_EVENTS);

    expect(warehousesQuery).toHaveBeenCalledTimes(2);
    expect(listingsQuery).toHaveBeenCalledTimes(1);
    expect(quietQuery).toHaveBeenCalledTimes(1);
    expect(unfilteredQuery).toHaveBeenCalledTimes(2);
    expect(dealQuery).toHaveBeenCalledTimes(1);
  });

  it('refetches every query of the channel when the event cases are unknown', async () => {
    const listingsQuery = observe(['listings'], { channels: [ORGANIZATION_CHANNEL], eventCases: ['listingsChanged'] });
    const quietQuery = observe(['quiet'], { channels: [ORGANIZATION_CHANNEL], eventCases: [] });

    await waitForQuery(['quiet']);

    await invalidateQueriesByChannel(queryClient, ORGANIZATION_CHANNEL, undefined);

    expect(listingsQuery).toHaveBeenCalledTimes(2);
    expect(quietQuery).toHaveBeenCalledTimes(2);
  });

  it('marks inactive queries of the channel as invalidated without fetching them', async () => {
    const queryFn = vi.fn<() => Promise<string>>(() => Promise.resolve('data'));
    await queryClient.query({
      meta: { channels: [ORGANIZATION_CHANNEL] },
      queryFn,
      queryKey: ['cached'],
    });
    await queryClient.query({
      meta: { channels: [DEAL_CHANNEL] },
      queryFn,
      queryKey: ['other'],
    });

    await invalidateQueriesByChannel(queryClient, ORGANIZATION_CHANNEL, undefined);

    expect(queryClient.getQueryState(['cached'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['other'])?.isInvalidated).toBe(false);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no query declares the channel', async () => {
    const queryFn = observe(['deal'], { channels: [DEAL_CHANNEL] });

    await invalidateQueriesByChannel(queryClient, ORGANIZATION_CHANNEL, undefined);

    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
