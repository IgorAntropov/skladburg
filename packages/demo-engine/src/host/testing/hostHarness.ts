import type { Client } from '@connectrpc/connect';

import {
  createClient,
  type Transport,
} from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

import type { IEngineConnection } from '../../client/index';
import type {
  EngineClientMessageValue,
  EngineHostMessageValue,
  EngineStatusValue,
} from '../../protocol/index';
import type {
  CoreModuleValue,
  IBroadcastChannel,
  IEngineHost,
  ILockManager,
  ITimerSource,
} from '../hostTypes';
import type { OpenedEngineStorageValue } from '../storage/index';
import type { FakeLockManagerValue } from './fakeLockManager';
import type { FakeTimersValue } from './fakeTimers';

import { connectToEngine } from '../../client/index';
import { createEngine } from '../../core/engine/createEngine';
import {
  createFakeRealTime,
  createSpyStorage,
  type FakeRealTimeValue,
  type SpyStorageValue,
} from '../../core/engine/testing/engineHarness';
import {
  ENGINE_BASE_URL,
  parseEngineHostMessage,
} from '../../protocol/index';
import { ENGINE_BROADCAST_CHANNEL_NAME } from '../constants';
import { createEngineHost } from '../createEngineHost';
import { createFakeLockManager } from './fakeLockManager';
import { createFakeTimers } from './fakeTimers';

export interface HostFixtureOverridesValue {
  isSingleTab?: boolean;
  loadCore?: () => Promise<CoreModuleValue>;
  openStorage?: () => Promise<OpenedEngineStorageValue>;
  requestTimeoutMs?: number;
  tabId?: string;
}

export interface HostFixtureValue {
  channelOutbox: () => readonly unknown[];
  connection: IEngineConnection;
  host: IEngineHost;
  inbox: unknown[];
  kill: () => void;
  messages: EngineHostMessageValue[];
  organization: (useBinaryFormat?: boolean) => Client<typeof OrganizationService>;
  sendToHost: (message: EngineClientMessageValue) => void;
  stop: () => Promise<void>;
  tabId: string;
}

export interface HostHarnessValue {
  addHost: (overrides?: HostFixtureOverridesValue) => HostFixtureValue;
  close: () => Promise<void>;
  lockManager: FakeLockManagerValue;
  openedChannelCount: () => number;
  openForeignChannel: () => BroadcastChannel;
  realTime: FakeRealTimeValue;
  storage: SpyStorageValue;
  timers: FakeTimersValue;
}

let channelCounter = 0;

export const createHostHarness = (storage: SpyStorageValue = createSpyStorage()): HostHarnessValue => {
  channelCounter += 1;
  const channelSuffix = `test-${String(channelCounter)}`;
  const lockManager = createFakeLockManager();
  const realTime = createFakeRealTime();
  const timers = createFakeTimers();
  const fixtures: HostFixtureValue[] = [];
  const openChannels: IBroadcastChannel[] = [];
  const foreignChannels: BroadcastChannel[] = [];
  const closers: (() => void)[] = [];
  let idCounter = 0;

  const generateId = (): string => {
    idCounter += 1;

    return `id-${String(idCounter)}`;
  };

  const addHost = (overrides: HostFixtureOverridesValue = {}): HostFixtureValue => {
    const { port1, port2 } = new MessageChannel();
    const messages: EngineHostMessageValue[] = [];
    const inbox: unknown[] = [];
    const channelOutbox: unknown[] = [];
    const tabId = overrides.tabId ?? generateId();
    const cancelTimers = new Set<() => void>();
    const heldLockNames = new Set<string>();
    const killController = new AbortController();
    let isTabIdPending = true;
    let isKilled = false;
    let closeChannel: () => void = () => undefined;

    port2.addEventListener('message', (event) => {
      inbox.push(event.data);
    });

    port1.addEventListener('message', (event) => {
      const message = parseEngineHostMessage(event.data);

      if (message !== undefined) {
        messages.push(message);
      }
    });

    const registerTimer = (cancel: () => void): (() => void) => {
      if (isKilled) {
        cancel();

        return () => undefined;
      }

      cancelTimers.add(cancel);

      return () => {
        cancelTimers.delete(cancel);
        cancel();
      };
    };

    const hostTimers: ITimerSource = {
      setInterval: (callback, intervalMs) => registerTimer(timers.setInterval(callback, intervalMs)),
      setTimeout: (callback, delayMs) => registerTimer(timers.setTimeout(callback, delayMs)),
    };

    const hostLockManager: ILockManager = {
      request: (name, requestOptions, callback) => lockManager.request(
        name,
        { signal: AbortSignal.any([requestOptions.signal, killController.signal]) },
        async () => {
          heldLockNames.add(name);

          try {
            await callback();
          }
          finally {
            heldLockNames.delete(name);
          }
        },
      ),
    };

    const connection = connectToEngine(port1);
    const host = createEngineHost({
      broadcastChannelFactory: (name) => {
        const inner = new BroadcastChannel(`${name}:${channelSuffix}`);
        openChannels.push(inner);
        closeChannel = () => {
          inner.close();
        };

        return {
          addEventListener: (type, listener) => {
            inner.addEventListener(type, listener);
          },
          close: () => {
            inner.close();
          },
          postMessage: (message) => {
            if (!isKilled) {
              channelOutbox.push(message);
              inner.postMessage(message);
            }
          },
          removeEventListener: (type, listener) => {
            inner.removeEventListener(type, listener);
          },
        };
      },
      generateId: () => {
        if (isTabIdPending) {
          isTabIdPending = false;

          return tabId;
        }

        return generateId();
      },
      loadCore: overrides.loadCore ?? (() => Promise.resolve({ createEngine })),
      lockManager: overrides.isSingleTab === true ? undefined : hostLockManager,
      openStorage: overrides.openStorage ?? (() => Promise.resolve({ kind: 'memory', storage })),
      port: port2,
      realTime,
      requestTimeoutMs: overrides.requestTimeoutMs,
      timers: hostTimers,
    });

    const createTransport = (useBinaryFormat: boolean): Transport => createConnectTransport({
      baseUrl: ENGINE_BASE_URL,
      fetch: connection.fetch,
      useBinaryFormat,
    });

    const kill = (): void => {
      if (isKilled) {
        return;
      }

      isKilled = true;

      for (const cancel of [...cancelTimers]) {
        cancel();
      }

      killController.abort();

      for (const name of [...heldLockNames]) {
        lockManager.forceRelease(name);
      }

      closeChannel();
      connection.close();
      port1.close();
      port2.close();
    };

    const fixture: HostFixtureValue = {
      channelOutbox: () => channelOutbox,
      connection,
      host,
      inbox,
      kill,
      messages,
      organization: (useBinaryFormat = true) => createClient(OrganizationService, createTransport(useBinaryFormat)),
      sendToHost: (message) => {
        port1.postMessage(message);
      },
      stop: async () => {
        if (isKilled) {
          return;
        }

        connection.close();
        await host.stop();
      },
      tabId,
    };

    closers.push(() => {
      port1.close();
      port2.close();
    });
    fixtures.push(fixture);

    return fixture;
  };

  const openForeignChannel = (): BroadcastChannel => {
    const channel = new BroadcastChannel(`${ENGINE_BROADCAST_CHANNEL_NAME}:${channelSuffix}`);
    foreignChannels.push(channel);

    return channel;
  };

  const close = async (): Promise<void> => {
    await Promise.all(fixtures.map(fixture => fixture.stop()));

    for (const channel of [...openChannels, ...foreignChannels]) {
      channel.close();
    }

    for (const closePorts of closers) {
      closePorts();
    }
  };

  return {
    addHost,
    close,
    lockManager,
    openedChannelCount: () => openChannels.length,
    openForeignChannel,
    realTime,
    storage,
    timers,
  };
};

export const readStatuses = (fixture: HostFixtureValue): EngineStatusValue[] =>
  fixture.messages.flatMap(message => message.type === 'status'
    ? [{
        coordination: message.coordination,
        epoch: message.epoch,
        role: message.role,
        storage: message.storage,
        storageHealth: message.storageHealth,
      }]
    : []);

export const readLastStatus = (fixture: HostFixtureValue): EngineStatusValue | undefined => readStatuses(fixture).at(-1);

export const countMessages = (fixture: HostFixtureValue, type: EngineHostMessageValue['type']): number =>
  fixture.messages.filter(message => message.type === type).length;
