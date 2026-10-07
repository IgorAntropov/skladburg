import type { ErrorDetail } from '@skladburg/contracts/common/v1/error';
import type { Event } from '@skladburg/contracts/event/v1/event';

import type { EngineChannelPositionValue } from '../core/events/index';
import type { DemoPersonaValue } from '../core/state/index';
import type {
  EngineStatusValue,
  EngineUnavailableMessageValue,
} from '../protocol/index';

export interface EngineConnectionOptionsValue {
  requestTimeoutMs?: number;
}

export type EngineConnectionStatusValue
  = | (EngineStatusValue & { state: 'ready' })
    | { reason: EngineUnavailableMessageValue['reason']; state: 'unavailable' };

export interface EngineSubscriptionHandlersValue {
  onDenied: (detail: ErrorDetail) => void;
  onEvents: (events: readonly Event[]) => void;
  onSubscribed: (position: EngineChannelPositionValue) => void;
}

export interface IEngineConnection {
  close: () => void;
  control: IEngineControl;
  fetch: typeof globalThis.fetch;
  onStatus: (listener: (status: EngineConnectionStatusValue) => void) => () => void;
  subscribe: (channel: string, headers: Headers, handlers: EngineSubscriptionHandlersValue) => () => void;
}

export interface IEngineControl {
  listPersonas: () => Promise<readonly DemoPersonaValue[]>;
  onReset: (listener: (epoch: string) => void) => () => void;
  reset: () => Promise<void>;
}
