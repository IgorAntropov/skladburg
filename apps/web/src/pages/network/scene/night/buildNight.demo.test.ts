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
  QUALITY_LEVEL_SETTINGS,
  WORLD_GLOW_RAMP,
} from '@/shared/3d';
import {
  collectPages,
  createApiRuntime,
} from '@/shared/api';

import { buildNetworkSceneLayout } from '../layout';
import { buildStreetLamps } from './buildStreetLamps';
import { buildWindowInstances } from './buildWindowInstances';

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

  it('lights the home customer city map with lamps and windows in sensible numbers on every level', async () => {
    const layout = await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1).then(buildNetworkSceneLayout);
    const lamps = buildStreetLamps(layout.roads, layout.cities);
    const windows = buildWindowInstances(layout.buildings, layout.cities);
    const companyWindows = layout.buildings.filter(building => building.isCompany).length * 10;
    const { high, low, medium } = QUALITY_LEVEL_SETTINGS;

    expect(lamps.count).toBeGreaterThanOrEqual(20);
    expect(lamps.count).toBeLessThanOrEqual(60);
    expect(windows.count).toBeGreaterThanOrEqual(350);
    expect(windows.count).toBeLessThanOrEqual(800);
    expect(lamps.getVisibleCount(high.decorDensity)).toBe(lamps.count);
    expect(lamps.getVisibleCount(low.decorDensity)).toBeLessThan(lamps.getVisibleCount(medium.decorDensity));
    expect(lamps.getVisibleCount(medium.decorDensity)).toBeLessThan(lamps.count);
    expect(windows.getVisibleCount(high.decorDensity)).toBe(windows.count);
    expect(windows.getVisibleCount(low.decorDensity)).toBeGreaterThanOrEqual(companyWindows);
    expect(windows.getVisibleCount(low.decorDensity)).toBeLessThan(windows.getVisibleCount(medium.decorDensity));
    expect(windows.getVisibleCount(medium.decorDensity)).toBeLessThan(windows.count);
  });

  it('keeps every lamp out of every city plaza and lights the lamps before the windows', async () => {
    const layout = await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1).then(buildNetworkSceneLayout);
    const lamps = buildStreetLamps(layout.roads, layout.cities);
    const windows = buildWindowInstances(layout.buildings, layout.cities);
    const litWindows = [...windows.delays].filter(delay => delay < 1);
    const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

    for (const lamp of lamps.lamps) {
      for (const city of layout.cities) {
        expect(Math.hypot(lamp.postX - city.x, lamp.postZ - city.z)).toBeGreaterThanOrEqual(city.radius + 2 - 1e-9);
      }
    }

    expect(mean([...lamps.delays])).toBeLessThan(mean(litWindows));
    expect(Math.max(...lamps.delays) + WORLD_GLOW_RAMP).toBeLessThanOrEqual(0.7 + 1e-6);
    expect(Math.max(...litWindows) + WORLD_GLOW_RAMP).toBeLessThanOrEqual(0.95 + 1e-6);
  });
});
