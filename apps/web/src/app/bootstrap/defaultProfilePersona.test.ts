import {
  createInProcessEngineConnection,
  SeedOrganizationId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
import { defaultTenant } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { ApiRuntimeValue } from '@/shared/api';

import { createApiRuntime } from '@/shared/api';

const closers: (() => Promise<void>)[] = [];

const startRuntimeForDefaultProfile = async (): Promise<ApiRuntimeValue> => {
  const inProcess = createInProcessEngineConnection();
  const runtime = await createApiRuntime({
    connection: inProcess.connection,
    defaultOrganizationId: defaultTenant.tenantId,
  });

  closers.push(async () => {
    runtime.close();
    await inProcess.close();
  });

  return runtime;
};

afterEach(async () => {
  for (const close of closers.splice(0)) {
    await close();
  }
});

describe('default build profile and the seed data of the demo engine', () => {
  it('names the customer organization of the seed data', () => {
    expect(defaultTenant.tenantId).toBe(SeedOrganizationId.CUSTOMER_1);
  });

  it('starts the runtime as the administrator of the profile organization', async () => {
    const runtime = await startRuntimeForDefaultProfile();

    expect(runtime.actingContext.get()).toEqual({
      organizationId: SeedOrganizationId.CUSTOMER_1,
      userId: SeedUserId.ADMIN_1,
    });
  });

  it('serves the organization of the profile with its warehouses', async () => {
    const runtime = await startRuntimeForDefaultProfile();

    const { organization } = await runtime.client.organization.getOrganization({
      organizationId: defaultTenant.tenantId,
    });
    const { warehouses } = await runtime.client.organization.listWarehouses({});

    expect(organization?.id).toBe(defaultTenant.tenantId);
    expect(warehouses).toHaveLength(3);
  });

  it('keeps the brand name and default locale of the profile equal to the engine settings', async () => {
    const runtime = await startRuntimeForDefaultProfile();

    const { settings } = await runtime.client.organization.getOrganizationSettings({});

    expect(settings?.organizationId).toBe(defaultTenant.tenantId);
    expect(settings?.brandName).toBe(defaultTenant.brandName);
    expect(settings?.defaultLocale).toBe(defaultTenant.defaultLocale);
  });
});
