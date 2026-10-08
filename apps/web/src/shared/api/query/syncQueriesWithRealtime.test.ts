import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { type QueryClient } from '@tanstack/react-query';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';

import type { IActingContextStore } from '../context/actingContextTypes';
import type { ApiErrorValue } from '../errors/apiErrorTypes';
import type { IRealtimeChannel } from '../realtime/realtimeTypes';
import type { FakeRealtimeSourceValue } from '../realtime/testing/createFakeRealtimeSource';
import type { ManualFrameSchedulerValue } from '../realtime/testing/createManualFrameScheduler';
import type { IDemoControl } from '../transport/demo';

import { createActingContextStore } from '../context/createActingContextStore';
import { createRealtimeChannel } from '../realtime/createRealtimeChannel';
import {
  createFakeRealtimeSource,
  createTestEvent,
} from '../realtime/testing/createFakeRealtimeSource';
import { createManualFrameScheduler } from '../realtime/testing/createManualFrameScheduler';
import { createQueryClient } from './createQueryClient';
import { syncQueriesWithRealtime } from './syncQueriesWithRealtime';

const ORGANIZATION_CHANNEL = 'org:11111111-1111-4111-8111-111111111111';
const DEAL_CHANNEL = 'deal:22222222-2222-4222-8222-222222222222';

const DENIED_ERROR: ApiErrorValue = {
  code: ErrorCode.PERMISSION_DENIED,
  isRetryable: false,
  params: { case: undefined, value: undefined },
  traceId: undefined,
};

interface FakeDemoControlValue {
  control: IDemoControl;
  emitReset: (epoch: string) => void;
  unsubscribeReset: ReturnType<typeof vi.fn<() => void>>;
}

const createFakeDemoControl = (): FakeDemoControlValue => {
  const listeners = new Set<(epoch: string) => void>();
  const unsubscribeReset = vi.fn<() => void>();

  return {
    control: {
      listPersonas: () => Promise.resolve([]),
      onReset: (listener) => {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
          unsubscribeReset();
        };
      },
      onStatus: () => () => undefined,
      reset: () => Promise.resolve(),
    },
    emitReset: (epoch) => {
      listeners.forEach((listener) => {
        listener(epoch);
      });
    },
    unsubscribeReset,
  };
};

describe('syncQueriesWithRealtime', () => {
  let actingContext: IActingContextStore;
  let queryClient: QueryClient;
  let realtime: IRealtimeChannel;
  let frames: ManualFrameSchedulerValue;
  let source: FakeRealtimeSourceValue;
  let subscribeSpy: MockInstance<IRealtimeChannel['subscribe']>;
  let invalidateSpy: MockInstance<QueryClient['invalidateQueries']>;
  let warnSpy: MockInstance<Console['warn']>;
  let stops: (() => void)[];

  const sync = (demoControl?: IDemoControl): (() => void) => {
    const stop = syncQueriesWithRealtime({ demoControl, queryClient, realtime });
    stops.push(stop);

    return stop;
  };

  const addQuery = async (key: string, channels: readonly string[] | undefined): Promise<void> => {
    await queryClient.query({
      meta: channels === undefined ? undefined : { channels },
      queryFn: () => Promise.resolve(key),
      queryKey: [key],
    });
  };

  const isInvalidated = (key: string): boolean | undefined => queryClient.getQueryState([key])?.isInvalidated;

  const findSourceSubscription = (channel: string): FakeRealtimeSourceValue['subscriptions'][number] | undefined =>
    source.subscriptions.find(subscription => subscription.channel === channel);

  const openChannel = (channel: string): FakeRealtimeSourceValue['subscriptions'][number] => {
    const subscription = findSourceSubscription(channel);

    if (subscription === undefined) {
      throw new Error(`channel is not subscribed: ${channel}`);
    }

    subscription.subscribed({ epoch: 'epoch-1', seq: 0n });

    return subscription;
  };

  beforeEach(() => {
    queryClient = createQueryClient({ networkMode: 'always' });
    frames = createManualFrameScheduler();
    source = createFakeRealtimeSource();
    actingContext = createActingContextStore({ organizationId: 'org-1', userId: 'user-1' });
    realtime = createRealtimeChannel({
      actingContext,
      frameScheduler: frames.scheduler,
      source: source.source,
    });
    subscribeSpy = vi.spyOn(realtime, 'subscribe');
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    stops = [];
  });

  afterEach(() => {
    stops.forEach((stop) => {
      stop();
    });
    realtime.stop();
    queryClient.clear();
    vi.restoreAllMocks();
  });

  describe('subscriptions', () => {
    it('subscribes to channels of queries that are already in the cache', async () => {
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);

      sync();

      expect(subscribeSpy).toHaveBeenCalledTimes(1);
      expect(subscribeSpy).toHaveBeenCalledWith(ORGANIZATION_CHANNEL, expect.any(Function));
    });

    it('subscribes when a query with channels is added later', async () => {
      sync();

      expect(subscribeSpy).not.toHaveBeenCalled();

      await addQuery('dashboard', [DEAL_CHANNEL, ORGANIZATION_CHANNEL]);

      expect(subscribeSpy.mock.calls.map(([channel]) => channel)).toEqual([DEAL_CHANNEL, ORGANIZATION_CHANNEL]);
    });

    it('subscribes once per channel for any number of queries', async () => {
      sync();

      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      await addQuery('members', [ORGANIZATION_CHANNEL]);
      await addQuery('dashboard', [DEAL_CHANNEL, ORGANIZATION_CHANNEL]);

      expect(subscribeSpy.mock.calls.map(([channel]) => channel)).toEqual([ORGANIZATION_CHANNEL, DEAL_CHANNEL]);
      expect(source.subscriptions).toHaveLength(2);
    });

    it('ignores queries without meta or channels', async () => {
      sync();

      await addQuery('plain', undefined);
      await addQuery('empty', []);

      expect(subscribeSpy).not.toHaveBeenCalled();
    });

    it('does not recount channels when a query is updated', async () => {
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      sync();
      const getAllSpy = vi.spyOn(queryClient.getQueryCache(), 'getAll');

      queryClient.setQueryData(['warehouses'], 'changed');

      expect(getAllSpy).not.toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledTimes(1);
    });

    it('keeps the subscription while another query uses the channel and drops it with the last one', async () => {
      sync();
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      await addQuery('members', [ORGANIZATION_CHANNEL]);
      const subscription = findSourceSubscription(ORGANIZATION_CHANNEL);

      queryClient.removeQueries({ queryKey: ['warehouses'] });

      expect(subscription?.isClosed()).toBe(false);

      queryClient.removeQueries({ queryKey: ['members'] });

      expect(subscription?.isClosed()).toBe(true);
    });

    it('drops only the channels that no query declares any more', async () => {
      sync();
      await addQuery('dashboard', [DEAL_CHANNEL, ORGANIZATION_CHANNEL]);
      await addQuery('deal', [DEAL_CHANNEL]);

      queryClient.removeQueries({ queryKey: ['dashboard'] });

      expect(findSourceSubscription(DEAL_CHANNEL)?.isClosed()).toBe(false);
      expect(findSourceSubscription(ORGANIZATION_CHANNEL)?.isClosed()).toBe(true);
    });

    it('subscribes again when a channel returns to the cache', async () => {
      sync();
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      queryClient.removeQueries({ queryKey: ['warehouses'] });

      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);

      expect(subscribeSpy).toHaveBeenCalledTimes(2);
      expect(source.subscriptions).toHaveLength(2);
      expect(source.subscriptions.at(1)?.isClosed()).toBe(false);
    });
  });

  describe('batches of the channel', () => {
    it('invalidates only queries of the channel once for an events batch', async () => {
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      await addQuery('members', [ORGANIZATION_CHANNEL]);
      await addQuery('deal', [DEAL_CHANNEL]);
      await addQuery('plain', undefined);
      sync();
      const subscription = openChannel(ORGANIZATION_CHANNEL);

      subscription.emit([
        createTestEvent(ORGANIZATION_CHANNEL, 1),
        createTestEvent(ORGANIZATION_CHANNEL, 2),
        createTestEvent(ORGANIZATION_CHANNEL, 3),
      ]);
      frames.flushFrame();

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(isInvalidated('warehouses')).toBe(true);
      expect(isInvalidated('members')).toBe(true);
      expect(isInvalidated('deal')).toBe(false);
      expect(isInvalidated('plain')).toBe(false);
    });

    it('invalidates only queries of the channel once for a resync batch', async () => {
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      await addQuery('deal', [DEAL_CHANNEL]);
      sync();
      const subscription = openChannel(ORGANIZATION_CHANNEL);

      subscription.emit([createTestEvent(ORGANIZATION_CHANNEL, 5)]);
      frames.flushFrame();

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(isInvalidated('warehouses')).toBe(true);
      expect(isInvalidated('deal')).toBe(false);
    });

    it('invalidates each channel separately', async () => {
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      await addQuery('deal', [DEAL_CHANNEL]);
      sync();
      openChannel(ORGANIZATION_CHANNEL).emit([createTestEvent(ORGANIZATION_CHANNEL, 1)]);
      openChannel(DEAL_CHANNEL);
      frames.flushFrame();

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(isInvalidated('warehouses')).toBe(true);
      expect(isInvalidated('deal')).toBe(false);
    });

    it('warns about a denied channel and invalidates nothing', async () => {
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      sync();

      findSourceSubscription(ORGANIZATION_CHANNEL)?.deny(DENIED_ERROR);
      frames.flushFrame();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('> syncQueriesWithRealtime -> denied:', {
        channel: ORGANIZATION_CHANNEL,
        code: ErrorCode.PERMISSION_DENIED,
      });
      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(isInvalidated('warehouses')).toBe(false);
    });
  });

  describe('change of the acting context', () => {
    it('invalidates the queries of every subscribed channel without subscribing again', async () => {
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      await addQuery('deal', [DEAL_CHANNEL]);
      await addQuery('plain', undefined);
      sync();
      openChannel(ORGANIZATION_CHANNEL);
      openChannel(DEAL_CHANNEL);
      subscribeSpy.mockClear();

      actingContext.set({ organizationId: 'org-2', userId: 'user-1' });
      frames.flushFrame();

      expect(subscribeSpy).not.toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
      expect(isInvalidated('warehouses')).toBe(true);
      expect(isInvalidated('deal')).toBe(true);
      expect(isInvalidated('plain')).toBe(false);
    });

    it('reopens the source subscriptions with the new context', async () => {
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      await addQuery('deal', [DEAL_CHANNEL]);
      sync();
      const previous = [findSourceSubscription(ORGANIZATION_CHANNEL), findSourceSubscription(DEAL_CHANNEL)];

      actingContext.set({ organizationId: 'org-2', userId: 'user-1' });

      expect(previous.every(subscription => subscription?.isClosed())).toBe(true);
      expect(source.subscriptions).toHaveLength(4);
      expect(source.subscriptions.slice(2).map(subscription => subscription.context.organizationId)).toEqual(['org-2', 'org-2']);
      expect(source.subscriptions.slice(2).every(subscription => !subscription.isClosed())).toBe(true);
    });

    it('warns about a denied subscription after the change and invalidates nothing', async () => {
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      sync();
      openChannel(ORGANIZATION_CHANNEL);
      subscribeSpy.mockClear();

      actingContext.set({ organizationId: 'org-2', userId: 'user-1' });
      source.subscriptions.at(-1)?.deny(DENIED_ERROR);
      frames.flushFrame();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('> syncQueriesWithRealtime -> denied:', {
        channel: ORGANIZATION_CHANNEL,
        code: ErrorCode.PERMISSION_DENIED,
      });
      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(isInvalidated('warehouses')).toBe(false);
      expect(subscribeSpy).not.toHaveBeenCalled();
      expect(source.subscriptions.at(-1)?.isClosed()).toBe(false);
    });

    it('keeps the synchronization subscription after a denial and resyncs when the previous context returns', async () => {
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      sync();
      openChannel(ORGANIZATION_CHANNEL);
      actingContext.set({ organizationId: 'org-2', userId: 'user-1' });
      source.subscriptions.at(-1)?.deny(DENIED_ERROR);
      frames.flushFrame();
      subscribeSpy.mockClear();

      actingContext.set({ organizationId: 'org-1', userId: 'user-1' });
      frames.flushFrame();

      expect(source.subscriptions).toHaveLength(3);
      expect(source.subscriptions.at(-1)?.context.organizationId).toBe('org-1');
      expect(subscribeSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(isInvalidated('warehouses')).toBe(true);
    });
  });

  describe('reset of the demo engine', () => {
    it('invalidates every query', async () => {
      const demo = createFakeDemoControl();
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      await addQuery('plain', undefined);
      sync(demo.control);

      demo.emitReset('epoch-2');

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith();
      expect(isInvalidated('warehouses')).toBe(true);
      expect(isInvalidated('plain')).toBe(true);
    });

    it('works without demo control', async () => {
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);

      expect(() => sync(undefined)).not.toThrow();
      expect(subscribeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('drops every channel subscription and the reset listener', async () => {
      const demo = createFakeDemoControl();
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      await addQuery('deal', [DEAL_CHANNEL]);
      const stop = sync(demo.control);

      stop();

      expect(source.subscriptions.every(subscription => subscription.isClosed())).toBe(true);
      expect(demo.unsubscribeReset).toHaveBeenCalledTimes(1);

      demo.emitReset('epoch-2');

      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('stops reacting to the cache', async () => {
      const stop = sync();

      stop();
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);

      expect(subscribeSpy).not.toHaveBeenCalled();
    });

    it('is safe to call twice', async () => {
      const demo = createFakeDemoControl();
      await addQuery('warehouses', [ORGANIZATION_CHANNEL]);
      const stop = sync(demo.control);

      stop();

      expect(() => {
        stop();
      }).not.toThrow();
      expect(demo.unsubscribeReset).toHaveBeenCalledTimes(1);
    });
  });
});
