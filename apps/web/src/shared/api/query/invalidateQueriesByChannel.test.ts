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

import { createQueryClient } from './createQueryClient';
import { invalidateQueriesByChannel } from './invalidateQueriesByChannel';

const ORGANIZATION_CHANNEL = 'org:11111111-1111-4111-8111-111111111111';
const DEAL_CHANNEL = 'deal:22222222-2222-4222-8222-222222222222';

describe('invalidateQueriesByChannel', () => {
  let queryClient: QueryClient;
  let stops: (() => void)[];

  const observe = (
    queryKey: readonly string[],
    channels: readonly string[] | undefined,
  ): ReturnType<typeof vi.fn<() => Promise<string>>> => {
    const queryFn = vi.fn<() => Promise<string>>(() => Promise.resolve('data'));
    const observer = new QueryObserver(queryClient, {
      meta: channels === undefined ? undefined : { channels },
      queryFn,
      queryKey,
      staleTime: Infinity,
    });

    stops.push(observer.subscribe(() => undefined));

    return queryFn;
  };

  beforeEach(() => {
    queryClient = createQueryClient();
    stops = [];
  });

  afterEach(() => {
    stops.forEach((stop) => {
      stop();
    });
    queryClient.clear();
  });

  it('refetches only queries that declare the channel', async () => {
    const organizationQuery = observe(['warehouses'], [ORGANIZATION_CHANNEL]);
    const multiChannelQuery = observe(['dashboard'], [DEAL_CHANNEL, ORGANIZATION_CHANNEL]);
    const dealQuery = observe(['deal'], [DEAL_CHANNEL]);
    const queryWithoutMeta = observe(['plain'], undefined);
    const queryWithoutChannels = observe(['empty'], []);

    await vi.waitFor(() => {
      expect(queryClient.getQueryState(['plain'])?.status).toBe('success');
    });

    await invalidateQueriesByChannel(queryClient, ORGANIZATION_CHANNEL);

    expect(organizationQuery).toHaveBeenCalledTimes(2);
    expect(multiChannelQuery).toHaveBeenCalledTimes(2);
    expect(dealQuery).toHaveBeenCalledTimes(1);
    expect(queryWithoutMeta).toHaveBeenCalledTimes(1);
    expect(queryWithoutChannels).toHaveBeenCalledTimes(1);
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

    await invalidateQueriesByChannel(queryClient, ORGANIZATION_CHANNEL);

    expect(queryClient.getQueryState(['cached'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['other'])?.isInvalidated).toBe(false);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no query declares the channel', async () => {
    const queryFn = observe(['deal'], [DEAL_CHANNEL]);

    await invalidateQueriesByChannel(queryClient, ORGANIZATION_CHANNEL);

    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
