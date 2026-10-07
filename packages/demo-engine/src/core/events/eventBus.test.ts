import type { Event } from '@skladburg/contracts/event/v1/event';

import {
  equals,
  fromBinary,
  fromJsonString,
  toBinary,
  toJsonString,
} from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { EventSchema } from '@skladburg/contracts/event/v1/event';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IStateTransaction } from '../state/index';

import { createSeedSnapshot } from '../seed/index';
import { createEngineState } from '../state/index';
import {
  createLiveMeta,
  TEST_WORLD_TIME_MS,
} from '../state/testRecords';
import { createEventBus } from './eventBus';

const ORG_A = 'org:aaaaaaaa';
const ORG_B = 'org:bbbbbbbb';

const createFixture = (): ReturnType<typeof createEngineState> => createEngineState(createSeedSnapshot());

const runInTransaction = (
  state: ReturnType<typeof createEngineState>,
  work: (transaction: IStateTransaction) => void,
  worldTimeMs = TEST_WORLD_TIME_MS,
): IStateTransaction => {
  const outcome = state.transact(worldTimeMs, (transaction) => {
    work(transaction);

    return transaction;
  }, createLiveMeta);
  outcome.apply();

  return outcome.result;
};

describe('createEventBus', () => {
  it('stamps every event of a transaction with the world time fixed for that transaction', () => {
    const state = createFixture();
    const bus = createEventBus({ getEpoch: () => 'e' });
    const received: Event[] = [];
    bus.subscribe(ORG_A, (events) => {
      received.push(...events);
    });
    bus.subscribe(ORG_B, (events) => {
      received.push(...events);
    });

    bus.publish(runInTransaction(state, (current) => {
      bus.outbox.add(current, ORG_A, { case: undefined });
      bus.outbox.add(current, ORG_B, { case: undefined });
      bus.outbox.add(current, ORG_A, { case: undefined });
    }, 7_000));

    expect(received.map(event => (event.occurredAt === undefined ? undefined : timestampMs(event.occurredAt)))).toEqual([
      7_000,
      7_000,
      7_000,
    ]);
  });

  it('produces events that survive the binary and JSON round trip', () => {
    const state = createFixture();
    const bus = createEventBus({ getEpoch: () => 'e' });
    const received: Event[] = [];
    bus.subscribe(ORG_A, (events) => {
      received.push(...events);
    });

    bus.publish(runInTransaction(state, (current) => {
      bus.outbox.add(current, ORG_A, { case: undefined });
    }, 1_800_000_000_123));

    const [event] = received;

    if (event === undefined) {
      throw new Error('Expected an event');
    }

    expect(equals(EventSchema, fromBinary(EventSchema, toBinary(EventSchema, event)), event)).toBe(true);
    expect(equals(EventSchema, fromJsonString(EventSchema, toJsonString(EventSchema, event)), event)).toBe(true);
  });

  it('stamps the events with the next seq of the channel, the epoch and the world time', () => {
    const state = createFixture();
    const bus = createEventBus({ getEpoch: () => 'epoch-x' });
    const received: Event[] = [];
    bus.subscribe(ORG_A, (events) => {
      received.push(...events);
    });

    const transaction = runInTransaction(state, (current) => {
      bus.outbox.add(current, ORG_A, { case: undefined });
      bus.outbox.add(current, ORG_A, { case: undefined });
    }, 1_234_000);
    bus.publish(transaction);

    expect(received.map(event => event.seq)).toEqual([1n, 2n]);
    expect(received.every(event => event.epoch === 'epoch-x' && event.channel === ORG_A)).toBe(true);
    expect(received.map(event => (event.occurredAt === undefined ? undefined : timestampMs(event.occurredAt)))).toEqual([
      1_234_000,
      1_234_000,
    ]);
  });

  it('does not deliver anything before the transaction is published', () => {
    const state = createFixture();
    const bus = createEventBus({ getEpoch: () => 'e' });
    const listener = vi.fn();
    bus.subscribe(ORG_A, listener);

    runInTransaction(state, (current) => {
      bus.outbox.add(current, ORG_A, { case: undefined });
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('delivers one batch per channel and listener', () => {
    const state = createFixture();
    const bus = createEventBus({ getEpoch: () => 'e' });
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();
    bus.subscribe(ORG_A, first);
    bus.subscribe(ORG_A, second);
    bus.subscribe(ORG_B, other);

    const transaction = runInTransaction(state, (current) => {
      bus.outbox.add(current, ORG_A, { case: undefined });
      bus.outbox.add(current, ORG_B, { case: undefined });
      bus.outbox.add(current, ORG_A, { case: undefined });
    });
    bus.publish(transaction);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
    expect(first.mock.calls[0]?.[0]).toHaveLength(2);
    expect(other.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it('does not call a listener for a channel nobody published to, and publishes a transaction only once', () => {
    const state = createFixture();
    const bus = createEventBus({ getEpoch: () => 'e' });
    const listener = vi.fn();
    bus.subscribe(ORG_A, listener);

    const transaction = runInTransaction(state, (current) => {
      bus.outbox.add(current, ORG_B, { case: undefined });
    });
    bus.publish(transaction);
    bus.publish(transaction);

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops delivering to a listener after it unsubscribed', () => {
    const state = createFixture();
    const bus = createEventBus({ getEpoch: () => 'e' });
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(ORG_A, listener);
    unsubscribe();
    unsubscribe();

    bus.publish(runInTransaction(state, (current) => {
      bus.outbox.add(current, ORG_A, { case: undefined });
    }));

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps delivering to the other listeners when one throws', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const state = createFixture();
    const bus = createEventBus({ getEpoch: () => 'e' });
    const healthy = vi.fn();
    bus.subscribe(ORG_A, () => {
      throw new Error('listener failed');
    });
    bus.subscribe(ORG_A, healthy);

    expect(() => {
      bus.publish(runInTransaction(state, (current) => {
        bus.outbox.add(current, ORG_A, { case: undefined });
      }));
    }).not.toThrow();

    expect(healthy).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it('does not let a listener that subscribes during delivery receive the same batch', () => {
    const state = createFixture();
    const bus = createEventBus({ getEpoch: () => 'e' });
    const late = vi.fn();
    bus.subscribe(ORG_A, () => {
      bus.subscribe(ORG_A, late);
    });

    bus.publish(runInTransaction(state, (current) => {
      bus.outbox.add(current, ORG_A, { case: undefined });
    }));

    expect(late).not.toHaveBeenCalled();
  });
});
