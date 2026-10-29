import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
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

import type { ApiRuntimeValue } from '@/shared/api';

import { createApiRuntime } from '@/shared/api';

import type { NetworkMapModelValue } from '../model/networkMapTypes';

import { fetchMapSites } from '../api/fetchMapSites';
import { fetchNetworkDirectory } from '../api/fetchNetworkDirectory';
import { buildNetworkMapModel } from './buildNetworkMapModel';

describe('network map model built from the demo engine', () => {
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

    const [directory, sites] = await Promise.all([fetchNetworkDirectory(runtime.client), fetchMapSites(runtime.client)]);

    return buildNetworkMapModel({ directory, locale: 'ru', organizationId, sites });
  };

  it('shows nine cities, eleven roads and twelve sites to a customer, its own sites first', async () => {
    if (runtime === undefined) {
      throw new Error('Runtime is not started');
    }

    const model = await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1);

    expect(model.cities).toHaveLength(9);
    expect(model.roads).toHaveLength(11);
    expect(model.sites).toHaveLength(12);
    expect(model.sites.slice(0, 3).every(site => site.isOwn && site.side === 'customer')).toBe(true);
    expect(model.sites.slice(3).some(site => site.isOwn)).toBe(false);

    const { warehouses } = await runtime.client.service(OrganizationService).listWarehouses({});

    expect(model.sites.slice(0, 3).map(site => site.id).toSorted()).toEqual(warehouses.map(warehouse => warehouse.id).toSorted());
    expect(model.sites.slice(0, 3).map(site => site.label).toSorted()).toEqual(warehouses.map(warehouse => warehouse.name).toSorted());
    expect(model.cities.flatMap(city => city.siteIds).toSorted()).toEqual(model.sites.map(site => site.id).toSorted());
  });

  it('shows only its own site to a supplier that is not verified', async () => {
    const model = await buildModelAs(SeedOrganizationId.SUPPLIER_5, SeedUserId.ADMIN_9);

    expect(model.cities).toHaveLength(9);
    expect(model.sites).toHaveLength(1);
    expect(model.sites[0]).toMatchObject({ isOwn: true, side: 'supplier' });
  });
});
