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
import type { AppSectionValue } from '@/shared/routing';

import { createApiRuntime } from '@/shared/api';

import { resolveAvailableSections } from './resolveAvailableSections';
import { selectLandingSection } from './selectLandingSection';

interface MatrixCaseValue {
  expectedSections: readonly AppSectionValue[];
  name: string;
  organizationId: string;
  userId: string;
}

const ALL_SECTIONS: readonly AppSectionValue[] = ['network', 'catalog', 'deals', 'warehouse'];

const MATRIX: readonly MatrixCaseValue[] = [
  {
    expectedSections: ALL_SECTIONS,
    name: 'administrator of a customer',
    organizationId: SeedOrganizationId.CUSTOMER_1,
    userId: SeedUserId.ADMIN_1,
  },
  {
    expectedSections: ALL_SECTIONS,
    name: 'administrator of a supplier',
    organizationId: SeedOrganizationId.SUPPLIER_1,
    userId: SeedUserId.ADMIN_2,
  },
  {
    expectedSections: ['network', 'deals'],
    name: 'administrator of a carrier',
    organizationId: SeedOrganizationId.CARRIER_1,
    userId: SeedUserId.ADMIN_4,
  },
  {
    expectedSections: ALL_SECTIONS,
    name: 'administrator of a supplier and carrier',
    organizationId: SeedOrganizationId.SUPPLIER_4,
    userId: SeedUserId.ADMIN_7,
  },
  {
    expectedSections: ['warehouse'],
    name: 'storekeeper of a customer',
    organizationId: SeedOrganizationId.CUSTOMER_1,
    userId: SeedUserId.STOREKEEPER_1,
  },
];

describe('available sections for sessions of the seed data', () => {
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

  const readSections = async (organizationId: string, userId: string): Promise<readonly AppSectionValue[]> => {
    if (runtime === undefined) {
      throw new Error('Runtime is not started');
    }

    runtime.actingContext.set({ organizationId, userId });

    return resolveAvailableSections(await runtime.client.access.getSession({}));
  };

  it.each(MATRIX)('resolves sections for the $name', async ({ expectedSections, organizationId, userId }) => {
    expect(await readSections(organizationId, userId)).toEqual(expectedSections);
  });

  it('starts the storekeeper on the warehouse', async () => {
    const sections = await readSections(SeedOrganizationId.CUSTOMER_1, SeedUserId.STOREKEEPER_1);

    expect(selectLandingSection(sections)).toBe('warehouse');
  });

  it('starts the others on the network', async () => {
    const sections = await readSections(SeedOrganizationId.CARRIER_1, SeedUserId.ADMIN_4);

    expect(selectLandingSection(sections)).toBe('network');
  });
});
