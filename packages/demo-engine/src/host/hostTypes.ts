import type {
  CreateEngineOptionsValue,
  IDemoEngine,
} from '../core/engine/index';
import type { IRealTimeSource } from '../core/ports/index';
import type { IEnginePort } from '../protocol/index';
import type { OpenedEngineStorageValue } from './storage/index';

export interface CoreModuleValue {
  createEngine: (options: CreateEngineOptionsValue) => Promise<IDemoEngine>;
}

export interface CreateEngineHostOptionsValue {
  broadcastChannelFactory: IBroadcastChannelFactory;
  checkpointIntervalMs?: number;
  generateId: () => string;
  loadCore: () => Promise<CoreModuleValue>;
  lockManager: ILockManager | undefined;
  openStorage: () => Promise<OpenedEngineStorageValue>;
  port: IEnginePort;
  realTime: IRealTimeSource;
  requestTimeoutMs?: number;
  tickIntervalMs?: number;
  timers: ITimerSource;
}

export interface IBroadcastChannel {
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
  close: () => void;
  postMessage: (message: unknown) => void;
  removeEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
}

export type IBroadcastChannelFactory = (name: string) => IBroadcastChannel;

export interface IEngineHost {
  stop: () => Promise<void>;
}

export interface ILockManager {
  request: (name: string, options: LockRequestOptionsValue, callback: () => Promise<void>) => Promise<void>;
}

export interface ITimerSource {
  setInterval: (callback: () => void, intervalMs: number) => () => void;
  setTimeout: (callback: () => void, delayMs: number) => () => void;
}

export interface LockRequestOptionsValue {
  signal: AbortSignal;
}
