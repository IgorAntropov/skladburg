import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  type ErrorDetail,
} from '@skladburg/contracts/common/v1/error';
import {
  OrganizationProfileSchema,
  OrganizationSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  ACTING_ORGANIZATION_HEADER,
  getPermissionName,
  listPermissionCodes,
  marketChannel,
  organizationChannel,
  userChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { TestRuntimeValue } from '../modules/testing/testRuntime';

import { createDomainErrors } from '../errors/index';
import { addTestMember } from '../modules/testing/moduleHarness';
import { createTestRuntime } from '../modules/testing/testRuntime';
import { createRandom } from '../ports/index';
import { DEMO_USER_HEADER } from '../protocol';
import {
  createSeedSnapshot,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../seed/index';
import {
  createSubscriptionAccess,
  MARKET_CHANNEL_PERMISSION,
  WAREHOUSE_CHANNEL_PERMISSION,
} from './subscriptionAccess';

const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

interface FixtureValue extends TestRuntimeValue {
  check: (channel: string, userId: string | undefined, organizationId?: string) => ErrorDetail | undefined;
}

const createHeaders = (userId: string | undefined, organizationId: string | undefined): Headers => {
  const headers = new Headers();

  if (userId !== undefined) {
    headers.set(DEMO_USER_HEADER, userId);
  }

  if (organizationId !== undefined) {
    headers.set(ACTING_ORGANIZATION_HEADER, organizationId);
  }

  return headers;
};

const createFixture = (): FixtureValue => {
  const testRuntime = createTestRuntime();
  const access = createSubscriptionAccess(createDomainErrors(createRandom(createSeedSnapshot().meta.traceRandomState)));

  return {
    ...testRuntime,
    check: (channel, userId, organizationId) =>
      access.check(testRuntime.state.read, channel, createHeaders(userId, organizationId)),
  };
};

const readPermission = (detail: ErrorDetail | undefined): undefined | { permission: string; warehouseId: string } =>
  detail?.params.case === 'permissionDenied'
    ? { permission: detail.params.value.permission, warehouseId: detail.params.value.warehouseId }
    : undefined;

describe('warehouse channel permission', () => {
  it('is a permission of the contract catalog', () => {
    expect(listPermissionCodes().map(getPermissionName)).toContain(WAREHOUSE_CHANNEL_PERMISSION);
  });
});

describe('subscription access to a warehouse channel', () => {
  const customerWarehouse = warehouseChannel(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1);

  it('lets a member with the organization-wide permission subscribe to any warehouse of the organization', () => {
    const { check } = createFixture();

    expect(check(customerWarehouse, SeedUserId.ADMIN_1)).toBeUndefined();
    expect(check(warehouseChannel(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3), SeedUserId.ADMIN_1)).toBeUndefined();
  });

  it('lets a member with an area subscribe to a warehouse of the area', () => {
    const { check } = createFixture();

    expect(check(customerWarehouse, SeedUserId.STOREKEEPER_1)).toBeUndefined();
  });

  it('denies a warehouse outside the area with permission_denied naming the permission and the warehouse', () => {
    const { check } = createFixture();

    const detail = check(warehouseChannel(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2), SeedUserId.STOREKEEPER_1);

    expect(detail?.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(readPermission(detail)).toEqual({ permission: 'warehouse_view', warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2 });
  });

  it('denies a member without the permission with permission_denied naming only the permission', async () => {
    const harness = createFixture();
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_1,
      permissions: ['member_view'],
      warehouseIds: [],
    });

    const detail = harness.check(customerWarehouse, userId);

    expect(detail?.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(readPermission(detail)).toEqual({ permission: 'warehouse_view', warehouseId: '' });
  });

  it('answers not_found for the warehouse of another organization as for a missing one', () => {
    const { check } = createFixture();

    const foreign = check(customerWarehouse, SeedUserId.ADMIN_2);
    const missing = check(warehouseChannel(UNKNOWN_ID), SeedUserId.ADMIN_2);

    for (const detail of [foreign, missing]) {
      expect(detail?.code).toBe(ErrorCode.NOT_FOUND);
      expect(detail?.params.case === 'notFound' ? detail.params.value.entity : undefined).toBe(EntityKind.WAREHOUSE);
    }

    expect(foreign?.params).toEqual(missing?.params);
  });

  it('answers session_required before looking at the warehouse', () => {
    const { check } = createFixture();

    expect(check(customerWarehouse, undefined)?.code).toBe(ErrorCode.SESSION_REQUIRED);
    expect(check(warehouseChannel(UNKNOWN_ID), UNKNOWN_ID)?.code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('does not take the organization from the acting header', () => {
    const { check } = createFixture();

    expect(check(customerWarehouse, SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1)).toBeUndefined();
    expect(check(customerWarehouse, SeedUserId.ADMIN_1, UNKNOWN_ID)).toBeUndefined();
  });

  it('does not draw from the main random stream when it denies', () => {
    const { check, random } = createFixture();
    const before = random.getState();

    check(customerWarehouse, SeedUserId.ADMIN_2);
    check('garbage', SeedUserId.ADMIN_1);

    expect(random.getState()).toEqual(before);
  });

  it('keeps the organization and user channels as before', () => {
    const { check } = createFixture();

    expect(check(organizationChannel(SeedOrganizationId.CUSTOMER_1), SeedUserId.ADMIN_1)).toBeUndefined();
    expect(check(userChannel(SeedUserId.ADMIN_1), SeedUserId.ADMIN_1)).toBeUndefined();
    expect(check(organizationChannel(SeedOrganizationId.SUPPLIER_1), SeedUserId.ADMIN_1)?.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });
});

describe('market channel permission', () => {
  it('is a permission of the contract catalog', () => {
    expect(listPermissionCodes().map(getPermissionName)).toContain(MARKET_CHANNEL_PERMISSION);
  });
});

describe('subscription access to the market channel', () => {
  const market = marketChannel();

  const readEntity = (detail: ErrorDetail | undefined): EntityKind | undefined =>
    detail?.params.case === 'notFound' ? detail.params.value.entity : undefined;

  const replaceProfiles = async (
    harness: FixtureValue,
    organizationId: string,
    profiles: { kind: ProfileKind; verificationLevel: number }[],
  ): Promise<void> => {
    const organization = create(OrganizationSchema, harness.state.read.get('organizations', organizationId));

    organization.profiles = profiles.map(profile => create(OrganizationProfileSchema, profile));

    await harness.runtime.command((transaction) => {
      transaction.put('organizations', organization);
    });
  };

  it('lets the director of a verified customer subscribe', () => {
    const { check } = createFixture();

    expect(check(market, SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1)).toBeUndefined();
  });

  it('lets the buyer of a verified customer subscribe', () => {
    const { check } = createFixture();

    expect(check(market, SeedUserId.BUYER_1, SeedOrganizationId.CUSTOMER_1)).toBeUndefined();
  });

  it('denies a supplier and a carrier with permission_denied naming marketplace_view', () => {
    const { check } = createFixture();

    const supplier = check(market, SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
    const carrier = check(market, SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1);

    for (const detail of [supplier, carrier]) {
      expect(detail?.code).toBe(ErrorCode.PERMISSION_DENIED);
      expect(readPermission(detail)).toEqual({ permission: 'marketplace_view', warehouseId: '' });
    }
  });

  it('answers membership_required without an acting organization', () => {
    const { check } = createFixture();

    expect(check(market, SeedUserId.ADMIN_1)?.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('answers membership_required for an organization the user is not a member of', () => {
    const { check } = createFixture();

    expect(check(market, SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_2)?.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    expect(check(market, SeedUserId.ADMIN_1, UNKNOWN_ID)?.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('answers session_required before looking at the organization', () => {
    const { check } = createFixture();

    expect(check(market, undefined, SeedOrganizationId.CUSTOMER_1)?.code).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('answers not_found for the channel when the customer profile is not verified', async () => {
    const harness = createFixture();

    await replaceProfiles(harness, SeedOrganizationId.CUSTOMER_1, [{ kind: ProfileKind.CUSTOMER, verificationLevel: 0 }]);

    const detail = harness.check(market, SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    expect(detail?.code).toBe(ErrorCode.NOT_FOUND);
    expect(readEntity(detail)).toBe(EntityKind.CHANNEL);
  });

  it('answers not_found for the channel when only another profile is verified', async () => {
    const harness = createFixture();

    await replaceProfiles(harness, SeedOrganizationId.CUSTOMER_1, [
      { kind: ProfileKind.CUSTOMER, verificationLevel: 0 },
      { kind: ProfileKind.CARRIER, verificationLevel: 1 },
    ]);

    const detail = harness.check(market, SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    expect(detail?.code).toBe(ErrorCode.NOT_FOUND);
    expect(readEntity(detail)).toBe(EntityKind.CHANNEL);
  });

  it('does not draw from the main random stream when it denies', () => {
    const { check, random } = createFixture();
    const before = random.getState();

    check(market, SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
    check(market, SeedUserId.ADMIN_1);

    expect(random.getState()).toEqual(before);
  });
});

describe('subscription access to a channel that cannot be reached', () => {
  const readEntity = (detail: ErrorDetail | undefined): EntityKind | undefined =>
    detail?.params.case === 'notFound' ? detail.params.value.entity : undefined;

  it('answers not_found for the channel for a malformed channel name', () => {
    const { check } = createFixture();

    for (const channel of ['', 'garbage', 'org:', 'org:a b', 'orders:1', 'warehouse']) {
      const detail = check(channel, SeedUserId.ADMIN_1);

      expect(detail?.code).toBe(ErrorCode.NOT_FOUND);
      expect(readEntity(detail)).toBe(EntityKind.CHANNEL);
    }
  });

  it('answers not_found for the channel for the user channel of another user', () => {
    const { check } = createFixture();

    const detail = check(userChannel(SeedUserId.ADMIN_2), SeedUserId.ADMIN_1);

    expect(detail?.code).toBe(ErrorCode.NOT_FOUND);
    expect(readEntity(detail)).toBe(EntityKind.CHANNEL);
  });
});
