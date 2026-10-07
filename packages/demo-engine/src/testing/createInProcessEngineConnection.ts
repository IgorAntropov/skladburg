import type { IEngineConnection } from '../client/index';
import type { IEngineStorage } from '../core/ports/index';
import type { EngineSeedValue } from '../core/seed/index';

import { connectToEngine } from '../client/index';
import { createEngine } from '../core/engine/createEngine';
import { createMemoryStorage } from '../core/ports/index';
import {
  createEngineHost,
  ENGINE_LOCK_NAME,
} from '../host/index';
import { createDetachedBroadcastChannel } from '../host/testing/detachedBroadcastChannel';
import { createFakeLockManager } from '../host/testing/fakeLockManager';
import { createFakeTimers } from '../host/testing/fakeTimers';

export const IN_PROCESS_REAL_TIME_START_MS = 1_000_000;

export interface InProcessEngineOptionsValue {
  requestTimeoutMs?: number;
  seed?: EngineSeedValue;
  storage?: IEngineStorage;
}

export interface InProcessEngineValue {
  advanceRealTime: (deltaMs: number) => void;
  close: () => Promise<void>;
  connection: IEngineConnection;
  isLeaderLockHeld: () => boolean;
  pendingTimerCount: () => number;
  runTimers: (deltaMs: number) => void;
  storage: IEngineStorage;
}

export const createInProcessEngineConnection = (options: InProcessEngineOptionsValue = {}): InProcessEngineValue => {
  const { port1, port2 } = new MessageChannel();
  const storage = options.storage ?? createMemoryStorage();
  const lockManager = createFakeLockManager();
  const timers = createFakeTimers();
  let realTimeMs = IN_PROCESS_REAL_TIME_START_MS;
  let idCounter = 0;

  const connection = connectToEngine(port1, { requestTimeoutMs: options.requestTimeoutMs });

  const host = createEngineHost({
    broadcastChannelFactory: createDetachedBroadcastChannel,
    generateId: () => {
      idCounter += 1;

      return `in-process-id-${String(idCounter)}`;
    },
    loadCore: () => Promise.resolve({
      createEngine: engineOptions => createEngine({ ...engineOptions, seed: options.seed }),
    }),
    lockManager,
    openStorage: () => Promise.resolve({ kind: 'memory', storage }),
    port: port2,
    realTime: { now: () => realTimeMs },
    requestTimeoutMs: options.requestTimeoutMs,
    timers,
  });

  const runTimers = (deltaMs: number): void => {
    timers.advance(deltaMs);
  };

  const close = async (): Promise<void> => {
    connection.close();
    await host.stop();
    port1.close();
    port2.close();
  };

  return {
    advanceRealTime: (deltaMs) => {
      realTimeMs += deltaMs;
    },
    close,
    connection,
    isLeaderLockHeld: () => lockManager.isHeld(ENGINE_LOCK_NAME),
    pendingTimerCount: () => timers.activeCount(),
    runTimers,
    storage,
  };
};
