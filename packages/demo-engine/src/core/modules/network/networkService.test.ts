import type { Client } from '@connectrpc/connect';

import {
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  MapSiteKind,
  NetworkService,
} from '@skladburg/contracts/network/v1/network';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createWarehouseRequest } from '../../engine/testing/engineHarness';
import {
  SeedOrganizationId,
  SeedRouteLegId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import {
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import { createNetworkService } from './networkService';

const SEED_NODE_COUNT = 9;
const SEED_CITY_COUNT = 9;
const SEED_ROUTE_LEG_COUNT = 11;
const SMALL_PAGE_SIZE = 4;
const CUSTOMER_1_OWN_SITE_COUNT = 3;
const CUSTOMER_1_FOREIGN_SITE_COUNT = 9;
const CREATE_WAREHOUSE_KEY = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';

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

describe('NetworkService.listRouteLegs', () => {
  it('returns the eleven route legs of the seed', async () => {
    const response = await createNetworkClient().listRouteLegs({}, callAs(SeedUserId.ADMIN_1));

    expect(response.routeLegs).toHaveLength(SEED_ROUTE_LEG_COUNT);
    expect(response.routeLegs.map(leg => leg.id)).toContain(SeedRouteLegId.MOSCOW_KAZAN);
    expect(response.page?.nextPageToken).toBe('');
  });

  it('serves a session alone: a carrier and a storekeeper without network_view read the legs too', async () => {
    const client = createNetworkClient();
    const carrier = await client.listRouteLegs({}, callAs(SeedUserId.ADMIN_4));
    const storekeeper = await client.listRouteLegs({}, callAs(SeedUserId.STOREKEEPER_1));

    expect(carrier.routeLegs).toHaveLength(SEED_ROUTE_LEG_COUNT);
    expect(storekeeper.routeLegs).toHaveLength(SEED_ROUTE_LEG_COUNT);
  });

  it('pages through the legs without gaps and duplicates', async () => {
    const client = createNetworkClient();
    const options = callAs(SeedUserId.ADMIN_1);
    const all = await client.listRouteLegs({}, options);
    const first = await client.listRouteLegs({ page: { pageSize: SMALL_PAGE_SIZE } }, options);
    const second = await client.listRouteLegs({ page: { pageSize: SMALL_PAGE_SIZE, pageToken: first.page?.nextPageToken } }, options);
    const third = await client.listRouteLegs({ page: { pageSize: SMALL_PAGE_SIZE, pageToken: second.page?.nextPageToken } }, options);

    expect(first.routeLegs).toHaveLength(SMALL_PAGE_SIZE);
    expect(third.routeLegs).toHaveLength(SEED_ROUTE_LEG_COUNT - 2 * SMALL_PAGE_SIZE);
    expect(third.page?.nextPageToken).toBe('');
    expect([...first.routeLegs, ...second.routeLegs, ...third.routeLegs].map(leg => leg.id)).toEqual(all.routeLegs.map(leg => leg.id));
  });

  it('rejects a call without a user with session_required', async () => {
    const error = await captureError(createNetworkClient().listRouteLegs({}, callAs(undefined)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });
});

describe('NetworkService.listMapSites', () => {
  it('shows the first customer three own named sites and nine foreign nameless ones without the unverified supplier', async () => {
    const { mapSites } = await createNetworkClient().listMapSites({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));
    const own = mapSites.filter(site => site.organizationId === SeedOrganizationId.CUSTOMER_1);
    const foreign = mapSites.filter(site => site.organizationId !== SeedOrganizationId.CUSTOMER_1);

    expect(mapSites).toHaveLength(CUSTOMER_1_OWN_SITE_COUNT + CUSTOMER_1_FOREIGN_SITE_COUNT);
    expect(own).toHaveLength(CUSTOMER_1_OWN_SITE_COUNT);
    expect(own.every(site => site.name !== '' && site.organizationName === 'Тёплый угол')).toBe(true);
    expect(foreign).toHaveLength(CUSTOMER_1_FOREIGN_SITE_COUNT);
    expect(foreign.every(site => site.name === '' && site.organizationName !== '')).toBe(true);
    expect(mapSites.map(site => site.id)).not.toContain(SeedWarehouseId.SUPPLIER_5_WAREHOUSE_1);
    expect(mapSites.every(site => site.kind === MapSiteKind.WAREHOUSE && site.cityId !== '' && site.mapNodeId !== '')).toBe(true);
  });

  it('shows the unverified supplier only its own site', async () => {
    const { mapSites } = await createNetworkClient().listMapSites({}, callAs(SeedUserId.ADMIN_9, SeedOrganizationId.SUPPLIER_5));

    expect(mapSites.map(site => site.id)).toEqual([SeedWarehouseId.SUPPLIER_5_WAREHOUSE_1]);
    expect(mapSites[0]?.name).not.toBe('');
  });

  it('shows the carrier twelve foreign nameless sites', async () => {
    const { mapSites } = await createNetworkClient().listMapSites({}, callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1));

    expect(mapSites).toHaveLength(CUSTOMER_1_OWN_SITE_COUNT + CUSTOMER_1_FOREIGN_SITE_COUNT);
    expect(mapSites.every(site => site.name === '' && site.organizationId !== SeedOrganizationId.CARRIER_1)).toBe(true);
  });

  it('marks the side of the owner: a supplier site as supplier and customer sites as customer', async () => {
    const { mapSites } = await createNetworkClient().listMapSites({}, callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1));
    const supplierSite = mapSites.find(site => site.id === SeedWarehouseId.SUPPLIER_4_WAREHOUSE_1);
    const customerSites = mapSites.filter(site => site.organizationId === SeedOrganizationId.CUSTOMER_2);

    expect(supplierSite?.profileKind).toBe(ProfileKind.SUPPLIER);
    expect(customerSites).toHaveLength(2);
    expect(customerSites.every(site => site.profileKind === ProfileKind.CUSTOMER)).toBe(true);
  });

  it('rejects a storekeeper without network_view with permission_denied', async () => {
    const options = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
    const error = await captureError(createNetworkClient().listMapSites({}, options));
    const detail = readErrorDetail(error);

    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('network_view');
  });

  it('rejects a call without a user with session_required', async () => {
    const error = await captureError(createNetworkClient().listMapSites({}, callAs(undefined)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('pages through the sites without gaps and duplicates in the order of the warehouse ids', async () => {
    const client = createNetworkClient();
    const options = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
    const all = await client.listMapSites({}, options);
    const first = await client.listMapSites({ page: { pageSize: SMALL_PAGE_SIZE } }, options);
    const second = await client.listMapSites({ page: { pageSize: SMALL_PAGE_SIZE, pageToken: first.page?.nextPageToken } }, options);
    const third = await client.listMapSites({ page: { pageSize: SMALL_PAGE_SIZE, pageToken: second.page?.nextPageToken } }, options);
    const pagedIds = [...first.mapSites, ...second.mapSites, ...third.mapSites].map(site => site.id);
    const allIds = all.mapSites.map(site => site.id);

    expect(first.mapSites).toHaveLength(SMALL_PAGE_SIZE);
    expect(third.mapSites).toHaveLength(allIds.length - 2 * SMALL_PAGE_SIZE);
    expect(third.page?.nextPageToken).toBe('');
    expect(pagedIds).toEqual(allIds);
    expect(allIds).toEqual([...allIds].sort());
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('shows a warehouse created by the first customer to him with the name and to a verified supplier without it', async () => {
    const harness = createModuleHarness();
    const network = createClient(NetworkService, harness.transport);
    const { warehouse } = await harness.organization.createWarehouse(
      createWarehouseRequest(CREATE_WAREHOUSE_KEY, { name: 'Склад 9' }),
      callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    );
    const own = await network.listMapSites({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1));
    const foreign = await network.listMapSites({}, callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1));
    const ownSite = own.mapSites.find(site => site.id === warehouse?.id);
    const foreignSite = foreign.mapSites.find(site => site.id === warehouse?.id);

    expect(ownSite?.name).toBe('Склад 9');
    expect(foreignSite).toBeDefined();
    expect(foreignSite?.name).toBe('');
    expect(foreignSite?.organizationName).toBe('Тёплый угол');
    expect(own.mapSites).toHaveLength(CUSTOMER_1_OWN_SITE_COUNT + CUSTOMER_1_FOREIGN_SITE_COUNT + 1);
  });
});
