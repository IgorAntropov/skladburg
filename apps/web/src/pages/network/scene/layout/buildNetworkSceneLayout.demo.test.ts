import { NetworkService } from '@skladburg/contracts/network/v1/network';
import {
  createInProcessEngineConnection,
  SeedOrganizationId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
import { defaultTenant } from 'virtual:build-profile';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkMapModelValue } from '@/entities/network';
import type { ApiRuntimeValue } from '@/shared/api';

import { buildNetworkMapModel } from '@/entities/network';
import {
  collectPages,
  createApiRuntime,
} from '@/shared/api';

import { NETWORK_WORLD_SIZE_METERS } from '../networkWorldConstants';
import { buildNetworkSceneLayout } from './buildNetworkSceneLayout';
import { CITY_RESERVE_RADIUS_METERS } from './buildTerrainReserved';
import {
  COMPANY_MIN_SPACING_METERS,
  MAP_EDGE_STRIP_METERS,
  MINI_CITY_MIN_SPACING_METERS,
  MINI_CITY_RADIUS_METERS,
} from './layoutConstants';
import {
  areBuildingsOverlapping,
  getFarthestCornerDistance,
  getSegmentDistance,
} from './layoutTestSupport';

describe('network scene layout built from the demo engine', () => {
  const inProcess = createInProcessEngineConnection();
  let runtime: ApiRuntimeValue | undefined;

  beforeAll(async () => {
    runtime = await createApiRuntime({
      connection: inProcess.connection,
      defaultOrganizationId: defaultTenant.tenantId,
    });
  });

  afterAll(async () => {
    runtime?.close();
    await inProcess.close();
  });

  const buildModelAs = async (organizationId: string, userId: string): Promise<NetworkMapModelValue> => {
    if (runtime === undefined) {
      throw new Error('Runtime is not started');
    }

    runtime.actingContext.set({ organizationId, userId });

    const network = runtime.client.service(NetworkService);

    const [cities, mapNodes, routeLegs, sites] = await Promise.all([
      collectPages(async (page) => {
        const response = await network.listCities({ page });

        return { items: response.cities, nextPageToken: response.page?.nextPageToken ?? '' };
      }),
      collectPages(async (page) => {
        const response = await network.listMapNodes({ page });

        return { items: response.mapNodes, nextPageToken: response.page?.nextPageToken ?? '' };
      }),
      collectPages(async (page) => {
        const response = await network.listRouteLegs({ page });

        return { items: response.routeLegs, nextPageToken: response.page?.nextPageToken ?? '' };
      }),
      collectPages(async (page) => {
        const response = await network.listMapSites({ page });

        return { items: response.mapSites, nextPageToken: response.page?.nextPageToken ?? '' };
      }),
    ]);

    return buildNetworkMapModel({ directory: { cities, mapNodes, routeLegs }, locale: 'ru', organizationId, sites });
  };

  it('keeps nine cities inside the world with the edge strip and apart from each other', async () => {
    const { cities } = buildNetworkSceneLayout(await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1));
    const limit = NETWORK_WORLD_SIZE_METERS / 2 - MAP_EDGE_STRIP_METERS - MINI_CITY_RADIUS_METERS;

    expect(cities).toHaveLength(9);

    for (const city of cities) {
      expect(Math.abs(city.x)).toBeLessThanOrEqual(limit + 1e-9);
      expect(Math.abs(city.z)).toBeLessThanOrEqual(limit + 1e-9);
    }

    for (const [index, city] of cities.entries()) {
      for (const other of cities.slice(index + 1)) {
        const distance = Math.hypot(city.x - other.x, city.z - other.z);

        expect(distance).toBeGreaterThanOrEqual(2 * MINI_CITY_RADIUS_METERS + MINI_CITY_MIN_SPACING_METERS);
      }
    }
  });

  it('gives each of the nine cities its own id and a name to put on the label', async () => {
    const { cities } = buildNetworkSceneLayout(await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1));

    expect(cities).toHaveLength(9);
    expect(new Set(cities.map(city => city.id)).size).toBe(9);
    expect(cities.every(city => city.name.trim() !== '')).toBe(true);
    expect(cities.map(city => city.name)).toContain('Воронеж');
  });

  it('keeps the road corridors out of the clearings of other cities', async () => {
    const layout = await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1).then(buildNetworkSceneLayout);

    expect(layout.roads).toHaveLength(11);
    expect(layout.terrainReserved.corridors).toHaveLength(11);

    for (const [index, road] of layout.roads.entries()) {
      const corridor = layout.terrainReserved.corridors[index];

      for (const city of layout.cities.filter(candidate => candidate.id !== road.fromCityId && candidate.id !== road.toCityId)) {
        const clearance = getSegmentDistance(city, road.from, road.to) - (corridor?.width ?? 0) / 2;

        expect(clearance).toBeGreaterThanOrEqual(CITY_RESERVE_RADIUS_METERS);
      }
    }
  });

  it('keeps buildings of all cities apart and inside their cities', async () => {
    const layout = await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1).then(buildNetworkSceneLayout);

    expect(layout.buildings.filter(building => building.isCompany)).toHaveLength(12);

    for (const city of layout.cities) {
      const cityBuildings = layout.buildings.filter(building => building.cityId === city.id);

      expect(cityBuildings.every(building => getFarthestCornerDistance(building, city) <= city.radius + 1e-9)).toBe(true);
      expect(city.radius).toBe(MINI_CITY_RADIUS_METERS);

      for (const [index, building] of cityBuildings.entries()) {
        for (const other of cityBuildings.slice(index + 1)) {
          expect(areBuildingsOverlapping(building, other)).toBe(false);

          if (building.isCompany && other.isCompany) {
            expect(Math.hypot(building.x - other.x, building.z - other.z)).toBeGreaterThanOrEqual(COMPANY_MIN_SPACING_METERS - 1e-9);
          }
        }
      }
    }
  });

  it('encloses the three own warehouses of the customer in the home', async () => {
    const layout = await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1).then(buildNetworkSceneLayout);
    const own = layout.buildings.filter(building => building.isOwn);

    expect(own).toHaveLength(3);
    expect(own.every(building => building.side === 'customer')).toBe(true);

    for (const building of own) {
      const reach = getFarthestCornerDistance(building, { x: layout.home.centerX, z: layout.home.centerZ });

      expect(reach).toBeLessThanOrEqual(layout.home.radius);
    }

    expect(layout.home.radius).toBeLessThan(NETWORK_WORLD_SIZE_METERS);
  });

  it('shows the whole network as the home of the carrier', async () => {
    const layout = await buildModelAs(SeedOrganizationId.CARRIER_1, SeedUserId.ADMIN_4).then(buildNetworkSceneLayout);

    expect(layout.buildings.some(building => building.isOwn)).toBe(false);

    for (const city of layout.cities) {
      expect(Math.hypot(city.x - layout.home.centerX, city.z - layout.home.centerZ) + city.radius).toBeLessThanOrEqual(layout.home.radius);
    }
  });

  it('keeps the terrain reserve the same for every persona', async () => {
    const customer = await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1).then(buildNetworkSceneLayout);
    const carrier = await buildModelAs(SeedOrganizationId.CARRIER_1, SeedUserId.ADMIN_4).then(buildNetworkSceneLayout);
    const supplier = await buildModelAs(SeedOrganizationId.SUPPLIER_5, SeedUserId.ADMIN_9).then(buildNetworkSceneLayout);

    expect(JSON.stringify(customer.terrainReserved)).toBe(JSON.stringify(carrier.terrainReserved));
    expect(JSON.stringify(supplier.terrainReserved)).toBe(JSON.stringify(carrier.terrainReserved));
  });
});
