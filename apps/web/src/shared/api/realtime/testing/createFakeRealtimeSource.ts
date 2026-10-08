import type { Event } from '@skladburg/contracts/event/v1/event';

import { create } from '@bufbuild/protobuf';
import { EventSchema } from '@skladburg/contracts/event/v1/event';

import type { ActingContextValue } from '../../context/actingContextTypes';
import type { ApiErrorValue } from '../../errors/apiErrorTypes';
import type {
  IRealtimeSource,
  RealtimePositionValue,
  RealtimeSourceHandlersValue,
} from '../realtimeTypes';

export interface FakeRealtimeSourceValue {
  source: IRealtimeSource;
  subscriptions: FakeSourceSubscriptionValue[];
}

export interface FakeSourceSubscriptionValue {
  channel: string;
  context: ActingContextValue;
  deny: (error: ApiErrorValue) => void;
  emit: (events: readonly Event[]) => void;
  handlers: RealtimeSourceHandlersValue;
  isClosed: () => boolean;
  subscribed: (position: RealtimePositionValue) => void;
}

export const createTestEvent = (channel: string, seq: number, epoch = 'epoch-1'): Event => create(EventSchema, {
  channel,
  epoch,
  seq: BigInt(seq),
});

export const createFakeRealtimeSource = (): FakeRealtimeSourceValue => {
  const subscriptions: FakeSourceSubscriptionValue[] = [];

  return {
    source: {
      subscribe: (channel, context, handlers) => {
        let isClosed = false;

        subscriptions.push({
          channel,
          context,
          deny: handlers.onDenied,
          emit: handlers.onEvents,
          handlers,
          isClosed: () => isClosed,
          subscribed: handlers.onSubscribed,
        });

        return () => {
          isClosed = true;
        };
      },
    },
    subscriptions,
  };
};
