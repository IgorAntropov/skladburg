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

import type { RealtimeEventCaseValue } from './apiQueryMetaTypes';

import { createQueryClient } from './createQueryClient';
import { invalidateQueriesByChannel } from './invalidateQueriesByChannel';
import {
  createOrganizationQueryMeta,
  RESYNC_ONLY_EVENT_CASES,
} from './organizationQueryScope';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_CHANNEL = `org:${ORGANIZATION_ID}`;

const WAREHOUSE_EVENT_CASES: readonly RealtimeEventCaseValue[] = ['warehouseChanged', 'warehouseCreated'];

const LISTINGS_EVENTS: ReadonlySet<RealtimeEventCaseValue> = new Set(['listingsChanged']);
const WAREHOUSE_EVENTS: ReadonlySet<RealtimeEventCaseValue> = new Set(['warehouseChanged']);

type QueryFnMockValue = ReturnType<typeof vi.fn<() => Promise<string>>>;
type QueryNameValue = 'organization' | 'requisites' | 'settings' | 'sites' | 'warehouses';

describe('createOrganizationQueryMeta', () => {
  it('declares the organization channel and the event cases', () => {
    expect(createOrganizationQueryMeta(ORGANIZATION_ID, WAREHOUSE_EVENT_CASES)).toEqual({
      channels: [ORGANIZATION_CHANNEL],
      eventCases: WAREHOUSE_EVENT_CASES,
    });
  });

  it('declares no channel without an organization', () => {
    expect(createOrganizationQueryMeta(undefined, RESYNC_ONLY_EVENT_CASES)).toEqual({
      channels: [],
      eventCases: [],
    });
  });
});

describe('queries of the organization channel', () => {
  let queryClient: QueryClient;
  let stops: (() => void)[];

  const observe = (
    queryKey: readonly string[],
    eventCases: readonly RealtimeEventCaseValue[],
  ): QueryFnMockValue => {
    const queryFn = vi.fn<() => Promise<string>>(() => Promise.resolve('data'));
    const observer = new QueryObserver(queryClient, {
      meta: createOrganizationQueryMeta(ORGANIZATION_ID, eventCases),
      queryFn,
      queryKey,
      staleTime: Infinity,
    });

    stops.push(observer.subscribe(() => undefined));

    return queryFn;
  };

  const observeAll = async (): Promise<Record<QueryNameValue, QueryFnMockValue>> => {
    const queries = {
      organization: observe(['organization'], RESYNC_ONLY_EVENT_CASES),
      requisites: observe(['requisites'], RESYNC_ONLY_EVENT_CASES),
      settings: observe(['settings'], RESYNC_ONLY_EVENT_CASES),
      sites: observe(['sites'], WAREHOUSE_EVENT_CASES),
      warehouses: observe(['warehouses'], WAREHOUSE_EVENT_CASES),
    };

    await vi.waitFor(() => {
      expect(queryClient.getQueryState(['warehouses'])?.status).toBe('success');
      expect(queryClient.getQueryState(['sites'])?.status).toBe('success');
      expect(queryClient.getQueryState(['organization'])?.status).toBe('success');
      expect(queryClient.getQueryState(['settings'])?.status).toBe('success');
      expect(queryClient.getQueryState(['requisites'])?.status).toBe('success');
    });

    return queries;
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

  it('are not refetched by a listings event', async () => {
    const queries = await observeAll();

    await invalidateQueriesByChannel(queryClient, ORGANIZATION_CHANNEL, LISTINGS_EVENTS);

    Object.values(queries).forEach((queryFn) => {
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });

  it('are refetched by a warehouse event only for warehouses and sites', async () => {
    const queries = await observeAll();

    await invalidateQueriesByChannel(queryClient, ORGANIZATION_CHANNEL, WAREHOUSE_EVENTS);

    expect(queries.warehouses).toHaveBeenCalledTimes(2);
    expect(queries.sites).toHaveBeenCalledTimes(2);
    expect(queries.organization).toHaveBeenCalledTimes(1);
    expect(queries.settings).toHaveBeenCalledTimes(1);
    expect(queries.requisites).toHaveBeenCalledTimes(1);
  });

  it('are all refetched by a resync', async () => {
    const queries = await observeAll();

    await invalidateQueriesByChannel(queryClient, ORGANIZATION_CHANNEL, undefined);

    Object.values(queries).forEach((queryFn) => {
      expect(queryFn).toHaveBeenCalledTimes(2);
    });
  });
});
