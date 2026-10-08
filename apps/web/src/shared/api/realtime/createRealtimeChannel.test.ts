import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IActingContextStore } from '../context/actingContextTypes';
import type { ApiErrorValue } from '../errors/apiErrorTypes';
import type {
  IRealtimeChannel,
  RealtimeBatchValue,
} from './realtimeTypes';
import type { FakeRealtimeSourceValue } from './testing/createFakeRealtimeSource';
import type { ManualFrameSchedulerValue } from './testing/createManualFrameScheduler';

import { createActingContextStore } from '../context/createActingContextStore';
import { createRealtimeChannel } from './createRealtimeChannel';
import {
  createFakeRealtimeSource,
  createTestEvent,
} from './testing/createFakeRealtimeSource';
import { createManualFrameScheduler } from './testing/createManualFrameScheduler';

const CHANNEL = 'org:10000001-0000-4000-8000-000000000000';
const OTHER_CHANNEL = 'org:10000002-0000-4000-8000-000000000000';

const DENIED_ERROR: ApiErrorValue = {
  code: ErrorCode.PERMISSION_DENIED,
  isRetryable: false,
  params: { case: undefined, value: undefined },
  traceId: undefined,
};

interface HarnessValue {
  actingContext: IActingContextStore;
  channel: IRealtimeChannel;
  frames: ManualFrameSchedulerValue;
  source: FakeRealtimeSourceValue;
}

const createHarness = (): HarnessValue => {
  const actingContext = createActingContextStore({ organizationId: 'org-1', userId: 'user-1' });
  const frames = createManualFrameScheduler();
  const source = createFakeRealtimeSource();
  const channel = createRealtimeChannel({ actingContext, frameScheduler: frames.scheduler, source: source.source });

  return { actingContext, channel, frames, source };
};

const collect = (channel: IRealtimeChannel, name: string = CHANNEL): { batches: RealtimeBatchValue[]; stop: () => void } => {
  const batches: RealtimeBatchValue[] = [];
  const stop = channel.subscribe(name, (batch) => {
    batches.push(batch);
  });

  return { batches, stop };
};

const readSeqs = (batch: RealtimeBatchValue | undefined): bigint[] =>
  batch?.kind === 'events' ? batch.events.map(event => event.seq) : [];

describe('createRealtimeChannel', () => {
  let harness: HarnessValue;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    harness.channel.stop();
    vi.restoreAllMocks();
  });

  describe('subscriptions of the source', () => {
    it('opens one source subscription for several listeners of a channel', () => {
      collect(harness.channel);
      collect(harness.channel);
      collect(harness.channel, OTHER_CHANNEL);

      expect(harness.source.subscriptions.map(subscription => subscription.channel)).toEqual([CHANNEL, OTHER_CHANNEL]);
    });

    it('passes the acting context to the source', () => {
      collect(harness.channel);

      expect(harness.source.subscriptions.at(0)?.context).toEqual({ organizationId: 'org-1', userId: 'user-1' });
    });

    it('keeps the source subscription until the last listener leaves', () => {
      const first = collect(harness.channel);
      const second = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;

      first.stop();

      expect(subscription?.isClosed()).toBe(false);

      second.stop();

      expect(subscription?.isClosed()).toBe(true);
    });

    it('opens a fresh source subscription when a channel is subscribed again', () => {
      collect(harness.channel).stop();
      collect(harness.channel);

      expect(harness.source.subscriptions).toHaveLength(2);
      expect(harness.source.subscriptions.at(0)?.isClosed()).toBe(true);
      expect(harness.source.subscriptions.at(1)?.isClosed()).toBe(false);
    });

    it('ignores a second call of the same unsubscribe', () => {
      const first = collect(harness.channel);
      collect(harness.channel);

      first.stop();
      first.stop();

      expect(harness.source.subscriptions.at(0)?.isClosed()).toBe(false);
    });
  });

  describe('delivery in frames', () => {
    it('sends nothing for the first position of the channel', () => {
      const { batches } = collect(harness.channel);

      harness.source.subscriptions.at(0)?.subscribed({ epoch: 'epoch-1', seq: 7n });
      harness.frames.flushFrame();

      expect(harness.frames.isPending()).toBe(false);
      expect(batches).toEqual([]);
    });

    it('delivers 30 events of one frame as a single call', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 0n });

      for (let seq = 1; seq <= 30; seq += 1) {
        subscription?.emit([createTestEvent(CHANNEL, seq)]);
      }

      expect(batches).toEqual([]);

      harness.frames.flushFrame();

      expect(batches).toHaveLength(1);
      expect(readSeqs(batches.at(0))).toEqual(Array.from({ length: 30 }, (_, index) => BigInt(index + 1)));
      expect(harness.frames.scheduleCount()).toBe(1);
    });

    it('calls every listener of the channel once per frame with the same batch', () => {
      const first = collect(harness.channel);
      const second = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 0n });

      subscription?.emit([createTestEvent(CHANNEL, 1), createTestEvent(CHANNEL, 2)]);
      harness.frames.flushFrame();

      expect(first.batches).toHaveLength(1);
      expect(second.batches).toHaveLength(1);
      expect(first.batches.at(0)).toBe(second.batches.at(0));
    });

    it('schedules one flush for all channels and delivers a batch per channel', () => {
      const first = collect(harness.channel);
      const second = collect(harness.channel, OTHER_CHANNEL);
      const [firstSubscription, secondSubscription] = harness.source.subscriptions;
      firstSubscription?.subscribed({ epoch: 'epoch-1', seq: 0n });
      secondSubscription?.subscribed({ epoch: 'epoch-1', seq: 0n });

      firstSubscription?.emit([createTestEvent(CHANNEL, 1)]);
      secondSubscription?.emit([createTestEvent(OTHER_CHANNEL, 1)]);

      expect(harness.frames.scheduleCount()).toBe(1);

      harness.frames.flushFrame();

      expect(first.batches).toHaveLength(1);
      expect(second.batches).toHaveLength(1);
    });

    it('starts a new batch for events that come after a flush', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 0n });

      subscription?.emit([createTestEvent(CHANNEL, 1)]);
      harness.frames.flushFrame();
      subscription?.emit([createTestEvent(CHANNEL, 2)]);
      harness.frames.flushFrame();

      expect(batches.map(readSeqs)).toEqual([[1n], [2n]]);
    });

    it('does not call a listener that left before the flush and cancels an empty flush', () => {
      const { batches, stop } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 0n });

      subscription?.emit([createTestEvent(CHANNEL, 1)]);
      stop();

      expect(harness.frames.isPending()).toBe(false);
      expect(harness.frames.cancelledCount()).toBe(1);

      harness.frames.flushFrame();

      expect(batches).toEqual([]);
    });

    it('keeps delivering to the others when a listener throws or leaves during the flush', () => {
      const delivered: RealtimeBatchValue[] = [];
      let stopSecond = (): void => undefined;
      harness.channel.subscribe(CHANNEL, () => {
        stopSecond();
      });
      harness.channel.subscribe(CHANNEL, () => {
        throw new Error('listener failure');
      });
      stopSecond = harness.channel.subscribe(CHANNEL, (batch) => {
        delivered.push(batch);
      });
      harness.channel.subscribe(CHANNEL, (batch) => {
        delivered.push(batch);
      });
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 0n });

      subscription?.emit([createTestEvent(CHANNEL, 1)]);
      harness.frames.flushFrame();

      expect(delivered).toHaveLength(1);
    });
  });

  describe('continuity of events', () => {
    it('answers events that arrive before the first position with resync', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;

      subscription?.emit([createTestEvent(CHANNEL, 1)]);
      subscription?.subscribed({ epoch: 'epoch-1', seq: 1n });
      harness.frames.flushFrame();

      expect(batches).toEqual([{ kind: 'resync' }]);
    });

    it('sends resync for a gap in seq and continues after it', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 4n });

      subscription?.emit([createTestEvent(CHANNEL, 7)]);
      harness.frames.flushFrame();
      subscription?.emit([createTestEvent(CHANNEL, 8)]);
      harness.frames.flushFrame();

      expect(batches.map(batch => batch.kind)).toEqual(['resync', 'events']);
      expect(readSeqs(batches.at(1))).toEqual([8n]);
    });

    it('lets resync swallow the events of the same frame', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 0n });

      subscription?.emit([createTestEvent(CHANNEL, 1), createTestEvent(CHANNEL, 2)]);
      subscription?.emit([createTestEvent(CHANNEL, 5)]);
      subscription?.emit([createTestEvent(CHANNEL, 6)]);
      harness.frames.flushFrame();

      expect(batches).toEqual([{ kind: 'resync' }]);
    });

    it('sends resync when the epoch changes in an event, then continues in the new epoch', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 3n });

      subscription?.emit([createTestEvent(CHANNEL, 1, 'epoch-2')]);
      harness.frames.flushFrame();
      subscription?.emit([createTestEvent(CHANNEL, 2, 'epoch-2')]);
      harness.frames.flushFrame();

      expect(batches.map(batch => batch.kind)).toEqual(['resync', 'events']);
    });

    it('sends resync when a repeated position has another epoch', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 3n });

      subscription?.subscribed({ epoch: 'epoch-2', seq: 0n });
      harness.frames.flushFrame();

      expect(batches).toEqual([{ kind: 'resync' }]);
    });

    it('sends resync when a repeated position in the same epoch is ahead of the last seq', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 3n });

      subscription?.subscribed({ epoch: 'epoch-1', seq: 9n });
      harness.frames.flushFrame();
      subscription?.emit([createTestEvent(CHANNEL, 10)]);
      harness.frames.flushFrame();

      expect(batches.map(batch => batch.kind)).toEqual(['resync', 'events']);
    });

    it('ignores a repeated position that does not move forward', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 3n });
      subscription?.emit([createTestEvent(CHANNEL, 4)]);
      harness.frames.flushFrame();

      subscription?.subscribed({ epoch: 'epoch-1', seq: 4n });
      subscription?.subscribed({ epoch: 'epoch-1', seq: 2n });

      expect(harness.frames.isPending()).toBe(false);
      expect(batches.map(batch => batch.kind)).toEqual(['events']);
    });

    it('drops repeated events', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 0n });

      subscription?.emit([createTestEvent(CHANNEL, 1), createTestEvent(CHANNEL, 2)]);
      subscription?.emit([createTestEvent(CHANNEL, 2), createTestEvent(CHANNEL, 1), createTestEvent(CHANNEL, 3)]);
      harness.frames.flushFrame();

      expect(batches.map(readSeqs)).toEqual([[1n, 2n, 3n]]);
    });

    it('schedules nothing for events that are all repeats', () => {
      collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 5n });

      subscription?.emit([createTestEvent(CHANNEL, 5), createTestEvent(CHANNEL, 3)]);

      expect(harness.frames.isPending()).toBe(false);
    });
  });

  describe('denied subscriptions', () => {
    it('delivers the error as a separate batch', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;

      subscription?.deny(DENIED_ERROR);
      harness.frames.flushFrame();

      expect(batches).toEqual([{ error: DENIED_ERROR, kind: 'denied' }]);
    });

    it('does not mix the error with events of the same frame', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 0n });

      subscription?.emit([createTestEvent(CHANNEL, 1)]);
      subscription?.deny(DENIED_ERROR);
      harness.frames.flushFrame();

      expect(batches.map(batch => batch.kind)).toEqual(['denied', 'events']);
    });

    it('drops the pending resync of the same frame and delivers only the error', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 0n });
      harness.frames.flushFrame();

      subscription?.subscribed({ epoch: 'epoch-2', seq: 0n });
      subscription?.deny(DENIED_ERROR);
      harness.frames.flushFrame();

      expect(batches).toEqual([{ error: DENIED_ERROR, kind: 'denied' }]);
    });

    it('delivers only the error when the new subscription after a context change is denied', () => {
      const { batches } = collect(harness.channel);
      harness.source.subscriptions.at(0)?.subscribed({ epoch: 'epoch-1', seq: 2n });

      harness.actingContext.set({ organizationId: 'org-2', userId: 'user-2' });
      harness.source.subscriptions.at(1)?.deny(DENIED_ERROR);
      harness.frames.flushFrame();

      expect(batches).toEqual([{ error: DENIED_ERROR, kind: 'denied' }]);
    });
  });

  describe('change of the acting context', () => {
    it('resubscribes every channel with the new context and sends resync', () => {
      const first = collect(harness.channel);
      const second = collect(harness.channel, OTHER_CHANNEL);
      harness.source.subscriptions.at(0)?.subscribed({ epoch: 'epoch-1', seq: 2n });
      harness.source.subscriptions.at(1)?.subscribed({ epoch: 'epoch-1', seq: 2n });

      harness.actingContext.set({ organizationId: 'org-2', userId: 'user-2' });

      expect(harness.source.subscriptions).toHaveLength(4);
      expect(harness.source.subscriptions.slice(0, 2).every(subscription => subscription.isClosed())).toBe(true);
      expect(harness.source.subscriptions.slice(2).map(subscription => subscription.context)).toEqual([
        { organizationId: 'org-2', userId: 'user-2' },
        { organizationId: 'org-2', userId: 'user-2' },
      ]);

      harness.frames.flushFrame();

      expect(first.batches).toEqual([{ kind: 'resync' }]);
      expect(second.batches).toEqual([{ kind: 'resync' }]);
    });

    it('takes the first position of the new subscription silently and then continues', () => {
      const { batches } = collect(harness.channel);
      harness.source.subscriptions.at(0)?.subscribed({ epoch: 'epoch-1', seq: 2n });
      harness.actingContext.set({ organizationId: 'org-2', userId: 'user-1' });
      harness.frames.flushFrame();
      const renewed = harness.source.subscriptions.at(1);

      renewed?.subscribed({ epoch: 'epoch-1', seq: 40n });
      renewed?.emit([createTestEvent(CHANNEL, 41)]);
      harness.frames.flushFrame();

      expect(batches.map(batch => batch.kind)).toEqual(['resync', 'events']);
      expect(readSeqs(batches.at(1))).toEqual([41n]);
    });

    it('ignores events and errors of the closed subscription', () => {
      const { batches } = collect(harness.channel);
      const stale = harness.source.subscriptions.at(0);
      stale?.subscribed({ epoch: 'epoch-1', seq: 2n });
      harness.actingContext.set({ organizationId: 'org-2', userId: 'user-1' });
      harness.frames.flushFrame();
      harness.source.subscriptions.at(1)?.subscribed({ epoch: 'epoch-1', seq: 2n });

      stale?.emit([createTestEvent(CHANNEL, 3)]);
      stale?.deny(DENIED_ERROR);
      stale?.subscribed({ epoch: 'epoch-9', seq: 99n });

      expect(harness.frames.isPending()).toBe(false);
      expect(batches.map(batch => batch.kind)).toEqual(['resync']);
    });

    it('drops an error of the old context', () => {
      const { batches } = collect(harness.channel);
      harness.source.subscriptions.at(0)?.deny(DENIED_ERROR);

      harness.actingContext.set({ organizationId: 'org-2', userId: 'user-1' });
      harness.frames.flushFrame();

      expect(batches).toEqual([{ kind: 'resync' }]);
    });

    it('does nothing when the context is set to the same values', () => {
      collect(harness.channel);

      harness.actingContext.set({ organizationId: 'org-1', userId: 'user-1' });

      expect(harness.source.subscriptions).toHaveLength(1);
      expect(harness.frames.isPending()).toBe(false);
    });

    it('does not reopen a channel that has no listeners left', () => {
      collect(harness.channel).stop();

      harness.actingContext.set({ organizationId: 'org-2', userId: 'user-1' });

      expect(harness.source.subscriptions).toHaveLength(1);
    });
  });

  describe('stop', () => {
    it('cancels the planned flush, closes the source and stops delivering', () => {
      const { batches } = collect(harness.channel);
      const [subscription] = harness.source.subscriptions;
      subscription?.subscribed({ epoch: 'epoch-1', seq: 0n });
      subscription?.emit([createTestEvent(CHANNEL, 1)]);

      harness.channel.stop();

      expect(harness.frames.isPending()).toBe(false);
      expect(harness.frames.cancelledCount()).toBe(1);
      expect(subscription?.isClosed()).toBe(true);

      subscription?.emit([createTestEvent(CHANNEL, 2)]);
      harness.frames.flushFrame();

      expect(batches).toEqual([]);
    });

    it('leaves the acting context', () => {
      collect(harness.channel);

      harness.channel.stop();
      harness.actingContext.set({ organizationId: 'org-2', userId: 'user-1' });

      expect(harness.source.subscriptions).toHaveLength(1);
    });

    it('refuses new listeners and can be called twice', () => {
      harness.channel.stop();
      const { stop } = collect(harness.channel);

      expect(harness.source.subscriptions).toHaveLength(0);
      expect(() => {
        stop();
        harness.channel.stop();
      }).not.toThrow();
    });

    it('allows a listener to leave after the stop', () => {
      const { stop } = collect(harness.channel);

      harness.channel.stop();

      expect(stop).not.toThrow();
    });
  });
});
