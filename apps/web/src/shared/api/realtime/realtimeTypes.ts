import type { Event } from '@skladburg/contracts/event/v1/event';

import type { ActingContextValue } from '../context/actingContextTypes';
import type { ApiErrorValue } from '../errors/apiErrorTypes';

export interface IFrameScheduler {
  schedule: (flush: () => void) => () => void;
}

export interface IRealtimeChannel {
  stop: () => void;
  subscribe: (channel: string, listener: (batch: RealtimeBatchValue) => void) => () => void;
}

export interface IRealtimeSource {
  subscribe: (
    channel: string,
    context: ActingContextValue,
    handlers: RealtimeSourceHandlersValue,
  ) => () => void;
}

export type RealtimeBatchValue
  = | { error: ApiErrorValue; kind: 'denied' }
    | { events: readonly Event[]; kind: 'events' }
    | { kind: 'resync' };

export interface RealtimePositionValue {
  epoch: string;
  seq: bigint;
}

export interface RealtimeSourceHandlersValue {
  onDenied: (error: ApiErrorValue) => void;
  onEvents: (events: readonly Event[]) => void;
  onSubscribed: (position: RealtimePositionValue) => void;
}
