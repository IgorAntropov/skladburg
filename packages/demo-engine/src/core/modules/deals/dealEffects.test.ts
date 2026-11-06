import { create } from '@bufbuild/protobuf';
import { MembershipSchema } from '@skladburg/contracts/access/v1/access';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { DealChange } from '@skladburg/contracts/deal/v1/deal_events';
import {
  DealNotice,
  NotificationKind,
} from '@skladburg/contracts/notification/v1/notification';
import {
  dealChannel,
  organizationChannel,
} from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/index';
import { addTestMember } from '../testing/moduleHarness';
import { publishDealEffects } from './dealEffects';
import {
  createEffectsDeal,
  createEffectsHarness,
} from './testing/dealEffectsFixtures';

describe('deal effects', () => {
  it.each([DealStatus.DRAFT, DealStatus.CANCELLED])('keeps unsubmitted status %s private from the supplier', async (status) => {
    const deal = createEffectsDeal(status);
    deal.submittedAt = undefined;
    const harness = await createEffectsHarness(deal);

    await harness.runtime.command((transaction) => {
      publishDealEffects(harness.runtime, transaction, deal, DealNotice.CANCELLED, DealChange.STATUS, deal.customerOrganizationId);
    });

    expect(harness.events.map(event => event.channel)).toEqual([
      organizationChannel(deal.customerOrganizationId),
      dealChannel(deal.id),
    ]);
    expect(harness.state.read.list('notifications')).toEqual([]);
    expect(harness.events.every(event => event.payload.case === 'dealChanged')).toBe(true);
  });

  it('publishes thin changes to both parties after submission and notifies permitted supplier members', async () => {
    const deal = createEffectsDeal(DealStatus.SUBMITTED);
    const harness = await createEffectsHarness(deal);
    const allowedUserId = await addTestMember(harness, {
      organizationId: deal.supplierOrganizationId,
      permissions: ['deal_view'],
      warehouseIds: [],
    });
    const deniedUserId = await addTestMember(harness, {
      organizationId: deal.supplierOrganizationId,
      permissions: ['member_view'],
      warehouseIds: [],
    });
    const scopedUserId = await addTestMember(harness, {
      organizationId: deal.supplierOrganizationId,
      permissions: ['deal_view'],
      warehouseIds: [SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1],
    });

    await harness.runtime.command((transaction) => {
      publishDealEffects(harness.runtime, transaction, deal, DealNotice.RECEIVED, DealChange.STATUS, deal.customerOrganizationId);
    });

    const changes = harness.events.filter(event => event.payload.case === 'dealChanged');
    const notifications = harness.state.read.list('notifications');

    expect(changes.map(event => event.channel)).toEqual([
      organizationChannel(deal.customerOrganizationId),
      dealChannel(deal.id),
      organizationChannel(deal.supplierOrganizationId),
    ]);
    expect(changes.every(event => event.payload.case === 'dealChanged'
      && event.payload.value.dealId === deal.id && event.payload.value.change === DealChange.STATUS)).toBe(true);
    expect(notifications.map(record => record.userId)).toContain(allowedUserId);
    expect(notifications.map(record => record.userId)).not.toContain(deniedUserId);
    expect(notifications.map(record => record.userId)).not.toContain(scopedUserId);
    expect(notifications.every(record => record.notification.organizationId === deal.supplierOrganizationId)).toBe(true);
    expect(notifications[0]?.notification).toMatchObject({
      kind: NotificationKind.DEAL_UPDATE,
      links: [{ target: { id: deal.id } }],
      params: { case: 'dealUpdate', value: { counterpartyOrganizationId: deal.customerOrganizationId, notice: DealNotice.RECEIVED } },
    });
  });

  it('checks current membership grants when sending the notification', async () => {
    const deal = createEffectsDeal(DealStatus.AGREED);
    const harness = await createEffectsHarness(deal);
    const membership = harness.state.read.listBy('memberships', 'userId', SeedUserId.ADMIN_1)
      .find(candidate => candidate.organizationId === deal.customerOrganizationId);

    expect(membership).toBeDefined();

    await harness.runtime.command((transaction) => {
      if (membership !== undefined) {
        transaction.put('memberships', create(MembershipSchema, { ...membership, roleAssignments: [] }));
      }
      publishDealEffects(harness.runtime, transaction, deal, DealNotice.CONFIRMED, DealChange.STATUS, deal.supplierOrganizationId);
    });

    const notifications = harness.state.read.list('notifications');

    expect(notifications.map(record => record.userId)).not.toContain(SeedUserId.ADMIN_1);
    expect(notifications.every(record => record.notification.organizationId === SeedOrganizationId.CUSTOMER_1)).toBe(true);
  });

  it('keeps notifications and events atomic with the deal when storage rejects the commit', async () => {
    const deal = createEffectsDeal(DealStatus.SUBMITTED);
    const harness = await createEffectsHarness(deal);
    vi.spyOn(harness.storage, 'commit').mockRejectedValueOnce(new Error('Storage unavailable'));

    await expect(harness.runtime.command((transaction) => {
      deal.status = DealStatus.AGREED;
      transaction.put('deals', deal);
      publishDealEffects(harness.runtime, transaction, deal, DealNotice.CONFIRMED, DealChange.STATUS, deal.supplierOrganizationId);
    })).rejects.toThrow();

    expect(harness.state.read.get('deals', deal.id)?.status).toBe(DealStatus.SUBMITTED);
    expect(harness.state.read.list('notifications')).toEqual([]);
    expect(harness.events).toEqual([]);
  });
});
