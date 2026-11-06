import { create } from '@bufbuild/protobuf';
import { MembershipSchema } from '@skladburg/contracts/access/v1/access';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  type ErrorDetail,
} from '@skladburg/contracts/common/v1/error';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  ACTING_ORGANIZATION_HEADER,
  dealChannel,
  SUPPORT_SESSION_HEADER,
} from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { TestRuntimeValue } from '../modules/testing/testRuntime';

import {
  createEffectsDeal,
  createEffectsHarness,
} from '../modules/deals/testing/dealEffectsFixtures';
import { addTestMember } from '../modules/testing/moduleHarness';
import { DEMO_USER_HEADER } from '../protocol';
import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../seed/index';
import { createSubscriptionAccess } from './subscriptionAccess';

const UNKNOWN_DEAL_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const headersFor = (userId: string, organizationId: string | undefined): Headers => {
  const headers = new Headers({ [DEMO_USER_HEADER]: userId });

  if (organizationId !== undefined) {
    headers.set(ACTING_ORGANIZATION_HEADER, organizationId);
  }

  return headers;
};

const checkDeal = (
  harness: TestRuntimeValue,
  dealId: string,
  userId: string,
  organizationId: string | undefined,
): ErrorDetail | undefined =>
  createSubscriptionAccess(harness.runtime.errors).check(harness.state.read, dealChannel(dealId), headersFor(userId, organizationId));

describe('subscription access to deal channels', () => {
  it.each([DealStatus.DRAFT, DealStatus.CANCELLED])('keeps unsubmitted status %s private, including its existence', async (status) => {
    const deal = createEffectsDeal(status);
    deal.submittedAt = undefined;
    const harness = await createEffectsHarness(deal);
    const denied = checkDeal(harness, deal.id, SeedUserId.ADMIN_2, deal.supplierOrganizationId);
    const missing = checkDeal(harness, UNKNOWN_DEAL_ID, SeedUserId.ADMIN_2, deal.supplierOrganizationId);

    expect(checkDeal(harness, deal.id, SeedUserId.ADMIN_1, deal.customerOrganizationId)).toBeUndefined();
    expect(denied?.code).toBe(ErrorCode.NOT_FOUND);
    expect(denied?.params).toEqual(missing?.params);
    expect(denied?.params.case === 'notFound' && denied.params.value.entity).toBe(EntityKind.DEAL);
  });

  it.each([DealStatus.SUBMITTED, DealStatus.COUNTER_OFFERED, DealStatus.AGREED, DealStatus.CANCELLED])(
    'admits both participants for submitted status %s and rejects a third organization',
    async (status) => {
      const deal = createEffectsDeal(status);
      const harness = await createEffectsHarness(deal);

      expect(checkDeal(harness, deal.id, SeedUserId.ADMIN_1, deal.customerOrganizationId)).toBeUndefined();
      expect(checkDeal(harness, deal.id, SeedUserId.ADMIN_2, deal.supplierOrganizationId)).toBeUndefined();
      expect(checkDeal(harness, deal.id, SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1)?.code).toBe(ErrorCode.NOT_FOUND);
    },
  );

  it('uses the acting organization instead of membership in a different participating organization', async () => {
    const deal = createEffectsDeal(DealStatus.SUBMITTED);
    const harness = await createEffectsHarness(deal);
    const userId = await addTestMember(harness, {
      organizationId: SeedOrganizationId.CUSTOMER_2,
      permissions: ['deal_view'],
      warehouseIds: [],
    });
    const customerMembership = harness.state.read.listBy('memberships', 'userId', SeedUserId.ADMIN_1)[0];

    await harness.runtime.command((transaction) => {
      transaction.put('memberships', create(MembershipSchema, {
        id: harness.random.uuid(),
        organizationId: deal.customerOrganizationId,
        roleAssignments: customerMembership?.roleAssignments,
        userId,
      }));
    });

    expect(checkDeal(harness, deal.id, userId, deal.customerOrganizationId)).toBeUndefined();
    expect(checkDeal(harness, deal.id, userId, SeedOrganizationId.CUSTOMER_2)?.code).toBe(ErrorCode.NOT_FOUND);
    expect(checkDeal(harness, deal.id, userId, undefined)?.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
    expect(checkDeal(harness, deal.id, userId, deal.supplierOrganizationId)?.code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it.each([
    { permissions: ['member_view'], warehouseIds: [] },
    { permissions: ['deal_view'], warehouseIds: [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1] },
  ])('requires an organization-wide deal_view grant: %j', async (grants) => {
    const deal = createEffectsDeal();
    const harness = await createEffectsHarness(deal);
    const userId = await addTestMember(harness, { ...grants, organizationId: deal.customerOrganizationId });
    const error = checkDeal(harness, deal.id, userId, deal.customerOrganizationId);

    expect(error?.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(error?.params.case === 'permissionDenied' && error.params.value.permission).toBe('deal_view');
  });

  it('rejects a revoked membership grant and a support session', async () => {
    const deal = createEffectsDeal();
    const harness = await createEffectsHarness(deal);
    const membership = harness.state.read.listBy('memberships', 'userId', SeedUserId.ADMIN_1)[0];
    const headers = headersFor(SeedUserId.ADMIN_1, deal.customerOrganizationId);
    headers.set(SUPPORT_SESSION_HEADER, 'session');

    expect(createSubscriptionAccess(harness.runtime.errors).check(harness.state.read, dealChannel(deal.id), headers)?.code)
      .toBe(ErrorCode.MEMBERSHIP_REQUIRED);

    await harness.runtime.command((transaction) => {
      if (membership !== undefined) {
        transaction.put('memberships', create(MembershipSchema, { ...membership, roleAssignments: [] }));
      }
    });

    expect(checkDeal(harness, deal.id, SeedUserId.ADMIN_1, deal.customerOrganizationId)?.code).toBe(ErrorCode.PERMISSION_DENIED);
  });
});
