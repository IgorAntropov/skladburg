import type { DemoPersonaValue } from '../core/state/index';

export const EngineControlCommand = {
  LIST_PERSONAS: 'list_personas',
  RESET: 'reset',
} as const;

export type EngineControlCommand = typeof EngineControlCommand[keyof typeof EngineControlCommand];

export const ENGINE_COORDINATIONS = ['shared', 'single-tab'] as const;
export const ENGINE_ROLES = ['follower', 'leader'] as const;
export const ENGINE_STORAGE_HEALTHS = ['failing', 'ok'] as const;
export const ENGINE_STORAGE_KINDS = ['indexed-db', 'memory'] as const;
export const ENGINE_UNAVAILABLE_REASONS = ['start_failed'] as const;

export interface EngineAbortMessageValue {
  requestId: string;
  type: 'abort';
}

export type EngineClientMessageValue
  = | EngineAbortMessageValue
    | EngineControlMessageValue
    | EngineRequestMessageValue
    | EngineSubscribeMessageValue
    | EngineUnsubscribeMessageValue;

export interface EngineControlMessageValue {
  command: EngineControlCommand;
  requestId: string;
  type: 'control';
}

export interface EngineControlResultMessageValue {
  personas?: DemoPersonaValue[];
  requestId: string;
  type: 'control_result';
}

export interface EngineEventsMessageValue {
  events: ArrayBuffer[];
  subscriptionId: string;
  type: 'events';
}

export type EngineHostMessageValue
  = | EngineControlResultMessageValue
    | EngineEventsMessageValue
    | EngineResetDoneMessageValue
    | EngineResponseMessageValue
    | EngineStatusMessageValue
    | EngineSubscribedMessageValue
    | EngineSubscriptionDeniedMessageValue
    | EngineTransportErrorMessageValue
    | EngineUnavailableMessageValue;

export interface EngineRequestMessageValue {
  body: ArrayBuffer;
  headers: HeaderPairValue[];
  method: string;
  requestId: string;
  type: 'request';
  url: string;
}

export interface EngineResetDoneMessageValue {
  epoch: string;
  type: 'reset_done';
}

export interface EngineResponseMessageValue {
  body: ArrayBuffer;
  headers: HeaderPairValue[];
  requestId: string;
  status: number;
  type: 'response';
}

export interface EngineStatusMessageValue extends EngineStatusValue {
  type: 'status';
}

export interface EngineStatusValue {
  coordination: typeof ENGINE_COORDINATIONS[number];
  epoch: string;
  role: typeof ENGINE_ROLES[number];
  storage: typeof ENGINE_STORAGE_KINDS[number];
  storageHealth: typeof ENGINE_STORAGE_HEALTHS[number];
}

export interface EngineSubscribedMessageValue {
  epoch: string;
  seq: bigint;
  subscriptionId: string;
  type: 'subscribed';
}

export interface EngineSubscribeMessageValue {
  channel: string;
  headers: HeaderPairValue[];
  subscriptionId: string;
  type: 'subscribe';
}

export interface EngineSubscriptionDeniedMessageValue {
  detail: ArrayBuffer;
  subscriptionId: string;
  type: 'subscription_denied';
}

export interface EngineTransportErrorMessageValue {
  requestId: string;
  type: 'transport_error';
}

export interface EngineUnavailableMessageValue {
  reason: typeof ENGINE_UNAVAILABLE_REASONS[number];
  type: 'engine_unavailable';
}

export interface EngineUnsubscribeMessageValue {
  subscriptionId: string;
  type: 'unsubscribe';
}

export type HeaderPairValue = [string, string];

export interface IEnginePort {
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
  postMessage: (message: unknown, transfer: Transferable[]) => void;
  removeEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
  start?: () => void;
}
