import type { Client } from '@connectrpc/connect';

import {
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { NetworkService } from '@skladburg/contracts/network/v1/network';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { SeedUserId } from '../../seed/index';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import { createNetworkService } from './networkService';

const SEED_NODE_COUNT = 9;
const SEED_CITY_COUNT = 9;
const SMALL_PAGE_SIZE = 4;

const createNetworkClient = (): Client<typeof NetworkService> => {
  const { runtime } = createTestRuntime();

  return createClient(NetworkService, createRouterTransport(({ service }) => {
    service(NetworkService, createNetworkService(runtime));
  }));
};

describe('NetworkService.listCities', () => {
  it('returns the cities of the seed with a session alone', async () => {
    const response = await createNetworkClient().listCities({}, callAs(SeedUserId.ADMIN_1));

    expect(response.cities).toHaveLength(SEED_CITY_COUNT);
    expect(response.cities.every(city => city.name !== '' && city.timeZone !== '')).toBe(true);
    expect(response.page?.nextPageToken).toBe('');
  });

  it('pages through the cities without gaps and duplicates', async () => {
    const client = createNetworkClient();
    const options = callAs(SeedUserId.ADMIN_1);
    const all = await client.listCities({}, options);
    const first = await client.listCities({ page: { pageSize: SMALL_PAGE_SIZE } }, options);
    const second = await client.listCities({ page: { pageSize: SMALL_PAGE_SIZE, pageToken: first.page?.nextPageToken } }, options);
    const third = await client.listCities({ page: { pageSize: SMALL_PAGE_SIZE, pageToken: second.page?.nextPageToken } }, options);

    expect(first.cities).toHaveLength(SMALL_PAGE_SIZE);
    expect(first.page?.nextPageToken).not.toBe('');
    expect(third.cities).toHaveLength(SEED_CITY_COUNT - 2 * SMALL_PAGE_SIZE);
    expect(third.page?.nextPageToken).toBe('');
    expect([...first.cities, ...second.cities, ...third.cities].map(city => city.id)).toEqual(all.cities.map(city => city.id));
    expect(new Set(all.cities.map(city => city.id)).size).toBe(SEED_CITY_COUNT);
  });

  it('rejects a call without a user with session_required', async () => {
    const error = await captureError(createNetworkClient().listCities({}, callAs(undefined)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });
});

describe('NetworkService.listMapNodes', () => {
  it('returns the map nodes of the seed with a session alone', async () => {
    const response = await createNetworkClient().listMapNodes({}, callAs(SeedUserId.ADMIN_1));

    expect(response.mapNodes).toHaveLength(SEED_NODE_COUNT);
    expect(response.page?.nextPageToken).toBe('');
  });

  it('pages through the map nodes without gaps and duplicates', async () => {
    const client = createNetworkClient();
    const options = callAs(SeedUserId.ADMIN_1);
    const all = await client.listMapNodes({}, options);
    const first = await client.listMapNodes({ page: { pageSize: SMALL_PAGE_SIZE } }, options);
    const second = await client.listMapNodes({ page: { pageSize: SMALL_PAGE_SIZE, pageToken: first.page?.nextPageToken } }, options);
    const third = await client.listMapNodes({ page: { pageSize: SMALL_PAGE_SIZE, pageToken: second.page?.nextPageToken } }, options);

    expect(first.mapNodes).toHaveLength(SMALL_PAGE_SIZE);
    expect(third.mapNodes).toHaveLength(SEED_NODE_COUNT - 2 * SMALL_PAGE_SIZE);
    expect(third.page?.nextPageToken).toBe('');
    const pagedIds = [...first.mapNodes, ...second.mapNodes, ...third.mapNodes].map(node => node.id);

    expect(pagedIds).toEqual(all.mapNodes.map(node => node.id));
    expect(new Set(all.mapNodes.map(node => node.id)).size).toBe(SEED_NODE_COUNT);
  });

  it('rejects a call without a user with session_required', async () => {
    const error = await captureError(createNetworkClient().listMapNodes({}, callAs(undefined)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });
});

describe('the map nodes and the cities of the seed together', () => {
  it('points every map node at an existing city and gives every city a map node', async () => {
    const client = createNetworkClient();
    const options = callAs(SeedUserId.ADMIN_1);
    const { cities } = await client.listCities({}, options);
    const { mapNodes } = await client.listMapNodes({}, options);
    const cityIds = new Set(cities.map(city => city.id));
    const nodeCityIds = new Set(mapNodes.map(node => node.cityId));

    expect(mapNodes.every(node => cityIds.has(node.cityId))).toBe(true);
    expect(cities.every(city => nodeCityIds.has(city.id))).toBe(true);
  });
});
