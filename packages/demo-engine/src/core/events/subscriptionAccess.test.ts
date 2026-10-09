import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  type ErrorDetail,
} from '@skladburg/contracts/common/v1/error';
import {
  ACTING_ORGANIZATION_HEADER,
  listPermissionNames,
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

import { ENGINE_SERVICES } from '../access/index';
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
  it('is a permission of the engine catalog', () => {
    expect(listPermissionNames(ENGINE_SERVICES)).toContain(WAREHOUSE_CHANNEL_PERMISSION);
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
