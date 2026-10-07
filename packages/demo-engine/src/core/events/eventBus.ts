import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  type Event,
  EventSchema,
} from '@skladburg/contracts/event/v1/event';

import type { IEventOutbox } from '../modules/index';
import type { IStateTransaction } from '../state/index';

export interface CreateEventBusOptionsValue {
  getEpoch: () => string;
}

export type EventListenerFunction = (events: readonly Event[]) => void;

export interface IEventBus {
  outbox: IEventOutbox;
  publish: (transaction: IStateTransaction) => void;
  subscribe: (channel: string, listener: EventListenerFunction) => () => void;
}

const groupByChannel = (events: readonly Event[]): Map<string, Event[]> => {
  const groups = new Map<string, Event[]>();

  for (const event of events) {
    const group = groups.get(event.channel);

    if (group === undefined) {
      groups.set(event.channel, [event]);
    }
    else {
      group.push(event);
    }
  }

  return groups;
};

export const createEventBus = (options: CreateEventBusOptionsValue): IEventBus => {
  const pendingByTransaction = new WeakMap<IStateTransaction, Event[]>();
  const listenersByChannel = new Map<string, Set<EventListenerFunction>>();

  const outbox: IEventOutbox = {
    add: (transaction, channel, payload) => {
      const event = create(EventSchema, {
        channel,
        epoch: options.getEpoch(),
        occurredAt: timestampFromMs(transaction.worldTimeMs),
        payload,
        seq: transaction.nextChannelSeq(channel),
      });
      const pending = pendingByTransaction.get(transaction);

      if (pending === undefined) {
        pendingByTransaction.set(transaction, [event]);
      }
      else {
        pending.push(event);
      }
    },
  };

  const deliver = (listener: EventListenerFunction, events: readonly Event[]): void => {
    try {
      listener(events);
    }
    catch (error) {
      console.log('> EventBus -> deliver:', { error });
    }
  };

  const publish = (transaction: IStateTransaction): void => {
    const pending = pendingByTransaction.get(transaction) ?? [];
    pendingByTransaction.delete(transaction);

    for (const [channel, events] of groupByChannel(pending)) {
      for (const listener of [...listenersByChannel.get(channel) ?? []]) {
        deliver(listener, events);
      }
    }
  };

  const subscribe = (channel: string, listener: EventListenerFunction): (() => void) => {
    const listeners = listenersByChannel.get(channel) ?? new Set<EventListenerFunction>();
    listeners.add(listener);
    listenersByChannel.set(channel, listeners);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0 && listenersByChannel.get(channel) === listeners) {
        listenersByChannel.delete(channel);
      }
    };
  };

  return { outbox, publish, subscribe };
};
