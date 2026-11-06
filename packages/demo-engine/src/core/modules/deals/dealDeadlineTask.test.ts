import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { DealNotice } from '@skladburg/contracts/notification/v1/notification';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { TestRuntimeValue } from '../testing/testRuntime';

import {
  createEngineCaller,
  createSpyStorage,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SEED_WORLD_START_MS,
  SeedUserId,
} from '../../seed/index';
import { createEngineState } from '../../state/index';
import { createDealDeadlines } from './dealDeadlines';
import { createDealDeadlineTask } from './dealDeadlineTask';
import {
  createEffectsDeal,
  createEffectsHarness,
} from './testing/dealEffectsFixtures';

const runDeadlines = (harness: TestRuntimeValue): Promise<void> => harness.runtime.command((transaction) => {
  createDealDeadlineTask(harness.runtime).run(transaction, transaction.worldTimeMs);
});

describe('deal deadline reminders', () => {
  it.each([
    [DealStatus.SUBMITTED, 'confirmation', DealNotice.CONFIRMATION_DUE],
    [DealStatus.COUNTER_OFFERED, 'counterOffer', DealNotice.COUNTER_OFFER_DUE],
  ] as const)('reminds only the waiting party in status %s once without changing the deal', async (status, kind, notice) => {
    const deal = createEffectsDeal(status);
    const harness = await createEffectsHarness(deal);
    deal.deadlines = await harness.runtime.command(transaction => createDealDeadlines(harness.runtime, transaction, deal, kind));
    const due = timestampFromMs(SEED_WORLD_START_MS);

    if (kind === 'confirmation') {
      deal.deadlines.confirmationDueAt = due;
    }
    else {
      deal.deadlines.counterOfferDueAt = due;
    }

    await harness.runtime.command((transaction) => {
      transaction.put('deals', deal);
    });
    await runDeadlines(harness);

    const notifications = harness.state.read.list('notifications');
    const organizationId = kind === 'confirmation' ? deal.supplierOrganizationId : deal.customerOrganizationId;

    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications.every(record => record.notification.organizationId === organizationId
      && record.notification.params.case === 'dealUpdate' && record.notification.params.value.notice === notice)).toBe(true);
    expect(harness.state.read.get('deals', deal.id)).toEqual(deal);
    expect(harness.events.every(event => event.payload.case === 'notificationsChanged')).toBe(true);

    await harness.runtime.command((transaction) => {
      for (const record of notifications) {
        transaction.delete('notifications', record.notification.id);
      }
    });
    harness.events.length = 0;
    await runDeadlines(harness);

    expect(harness.state.read.list('notifications')).toEqual([]);
    expect(harness.events).toEqual([]);
    const snapshot = await harness.storage.load();

    if (snapshot === undefined) {
      throw new Error('Expected persisted snapshot');
    }

    expect(createEngineState(snapshot).read.get('dealReminderMarks', deal.id))
      .toEqual(harness.state.read.get('dealReminderMarks', deal.id));
  });

  it('does not remind before the exact deadline or after a final status', async () => {
    const deal = createEffectsDeal(DealStatus.SUBMITTED);
    const harness = await createEffectsHarness(deal);
    deal.deadlines = await harness.runtime.command(transaction => createDealDeadlines(harness.runtime, transaction, deal, 'confirmation'));
    deal.deadlines.confirmationDueAt = timestampFromMs(SEED_WORLD_START_MS + 1);
    await harness.runtime.command((transaction) => {
      transaction.put('deals', deal);
    });
    await runDeadlines(harness);

    expect(harness.state.read.list('notifications')).toEqual([]);

    deal.status = DealStatus.CANCELLED;
    deal.deadlines.confirmationDueAt = timestampFromMs(SEED_WORLD_START_MS);
    await harness.runtime.command((transaction) => {
      transaction.put('deals', deal);
    });
    await runDeadlines(harness);

    expect(harness.state.read.list('notifications')).toEqual([]);
    expect(harness.state.read.list('dealReminderMarks')).toEqual([]);
  });

  it('rolls back reminder marks and notifications together if persistence fails, then retries safely', async () => {
    const deal = createEffectsDeal(DealStatus.SUBMITTED);
    const harness = await createEffectsHarness(deal);
    deal.deadlines = await harness.runtime.command(transaction => createDealDeadlines(harness.runtime, transaction, deal, 'confirmation'));
    deal.deadlines.confirmationDueAt = timestampFromMs(SEED_WORLD_START_MS);
    await harness.runtime.command((transaction) => {
      transaction.put('deals', deal);
    });
    vi.spyOn(harness.storage, 'commit').mockRejectedValueOnce(new Error('Storage unavailable'));

    await expect(runDeadlines(harness)).rejects.toThrow();
    expect(harness.state.read.list('dealReminderMarks')).toEqual([]);
    expect(harness.state.read.list('notifications')).toEqual([]);
    expect(harness.events).toEqual([]);

    await runDeadlines(harness);

    expect(harness.state.read.list('dealReminderMarks')).toHaveLength(1);
    expect(harness.state.read.list('notifications').length).toBeGreaterThan(0);
  });

  it('runs through the engine scheduler after restart and does not repeat a persisted reminder', async () => {
    const deal = createEffectsDeal(DealStatus.SUBMITTED);
    const harness = await createEffectsHarness(deal);
    deal.deadlines = await harness.runtime.command(transaction => createDealDeadlines(harness.runtime, transaction, deal, 'confirmation'));
    deal.deadlines.confirmationDueAt = timestampFromMs(SEED_WORLD_START_MS + 1);
    await harness.runtime.command((transaction) => {
      transaction.put('deals', deal);
    });
    const snapshot = await harness.storage.load();

    if (snapshot === undefined) {
      throw new Error('Expected persisted snapshot');
    }

    const storage = createSpyStorage(snapshot);
    const first = await createTestEngine({ storage });
    first.realTime.advance(60_000);
    await first.engine.tick();
    const firstCaller = createEngineCaller(first.engine);
    const options = firstCaller.options(SeedUserId.ADMIN_2, deal.supplierOrganizationId);
    const sent = await firstCaller.notification.listNotifications({}, options);

    expect(sent.notifications).toHaveLength(1);
    expect(sent.notifications[0]?.params).toMatchObject({ case: 'dealUpdate', value: { notice: DealNotice.CONFIRMATION_DUE } });
    await first.engine.checkpoint();

    const restarted = await createTestEngine({ storage });
    restarted.realTime.advance(60_000);
    await restarted.engine.tick();
    const restartedCaller = createEngineCaller(restarted.engine);
    const afterRestart = await restartedCaller.notification.listNotifications({}, options);

    expect(afterRestart.notifications.map(notification => notification.id))
      .toEqual(sent.notifications.map(notification => notification.id));
  });
});
