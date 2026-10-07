import type {
  EngineHostMessageValue,
  EngineStatusValue,
} from '../protocol/index';
import type { EngineBroadcastMessageValue } from './broadcastMessages';
import type {
  CreateEngineHostOptionsValue,
  IEngineHost,
  ILockManager,
} from './hostTypes';
import type { ILeaderService } from './leaderService';
import type { OpenedEngineStorageValue } from './storage/index';

import { createMemoryStorage } from '../core/ports/index';
import { parseEngineClientMessage } from '../protocol/index';
import { parseEngineBroadcastMessage } from './broadcastMessages';
import {
  CHECKPOINT_INTERVAL_MS,
  createTabLockName,
  ENGINE_BROADCAST_CHANNEL_NAME,
  ENGINE_LOCK_NAME,
  HOST_REQUEST_TIMEOUT_MS,
  TICK_INTERVAL_MS,
} from './constants';
import { startEngine } from './engineStartup';
import { createFollowerRelay } from './followerRelay';
import { createLeaderService } from './leaderService';
import { readMessageTransfer } from './messageTransfer';
import {
  createStorageHealthMonitor,
  type StorageHealthValue,
} from './storageHealthMonitor';

const openMemoryStorage = (): Promise<OpenedEngineStorageValue> => Promise.resolve({
  kind: 'memory',
  storage: createMemoryStorage(),
});

const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError';

export const createEngineHost = (options: CreateEngineHostOptionsValue): IEngineHost => {
  const { port } = options;
  const tabId = options.generateId();
  const { lockManager } = options;
  const coordination: EngineStatusValue['coordination'] = lockManager === undefined ? 'single-tab' : 'shared';
  const channel = lockManager === undefined ? undefined : options.broadcastChannelFactory(ENGINE_BROADCAST_CHANNEL_NAME);
  const lockAbort = new AbortController();
  let leader: ILeaderService | undefined;
  let leaderStorage: EngineStatusValue['storage'] = 'memory';
  let storageHealth: StorageHealthValue = 'ok';
  let releaseLock: () => void = () => undefined;
  const lockReleased = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  let leaderStartup: Promise<void> | undefined;
  let hasLeaderLock = false;
  let hasTabLock = lockManager === undefined;
  let releaseTabLock: () => void = () => undefined;
  const tabLockReleased = new Promise<void>((resolve) => {
    releaseTabLock = resolve;
  });
  let closeStorage: () => void = () => undefined;
  let stopPromise: Promise<void> | undefined;
  let isStopped = false;
  let isEngineUnavailable = false;

  const postToPort = (message: EngineHostMessageValue): void => {
    if (!isStopped) {
      port.postMessage(message, readMessageTransfer(message));
    }
  };

  const postToChannel = (message: EngineBroadcastMessageValue): void => {
    if (!isStopped) {
      channel?.postMessage(message);
    }
  };

  const relay = createFollowerRelay({
    postToLeader: (message) => {
      postToChannel({ message, tabId, type: 'relay_to_leader' });
    },
    postToPort,
    requestTimeoutMs: options.requestTimeoutMs ?? HOST_REQUEST_TIMEOUT_MS,
    timers: options.timers,
  });

  const sendToTab = (targetTabId: string, message: EngineHostMessageValue): void => {
    if (targetTabId === tabId) {
      postToPort(message);

      return;
    }

    postToChannel({ message, tabId: targetTabId, type: 'relay_to_tab' });
  };

  const announceLeader = (service: ILeaderService): void => {
    postToChannel({ epoch: service.epoch(), storage: leaderStorage, storageHealth, type: 'leader_ready' });
  };

  const postLeaderStatus = (epoch: string): void => {
    postToPort({ coordination, epoch, role: 'leader', storage: leaderStorage, storageHealth, type: 'status' });
  };

  const handleStorageHealthChange = (health: StorageHealthValue): void => {
    storageHealth = health;

    if (leader !== undefined) {
      postLeaderStatus(leader.epoch());
      announceLeader(leader);
    }
  };

  const storageHealthMonitor = createStorageHealthMonitor({ onChange: handleStorageHealthChange });

  const handleReset = (epoch: string): void => {
    postLeaderStatus(epoch);
    postToPort({ epoch, type: 'reset_done' });
    postToChannel({ epoch, type: 'reset_done' });
  };

  const assumeLeadership = async (): Promise<void> => {
    const started = await startEngine({
      generateId: options.generateId,
      loadCore: options.loadCore,
      openStorage: lockManager === undefined ? openMemoryStorage : options.openStorage,
      realTime: options.realTime,
      storageHealthMonitor,
    });

    if (isStopped) {
      started.closeStorage();

      return;
    }

    const service = createLeaderService({
      checkpointIntervalMs: options.checkpointIntervalMs ?? CHECKPOINT_INTERVAL_MS,
      engine: started.engine,
      generateId: options.generateId,
      lockManager,
      onReset: handleReset,
      ownTabId: tabId,
      sendToTab,
      tickIntervalMs: options.tickIntervalMs ?? TICK_INTERVAL_MS,
      timers: options.timers,
    });
    const pending = relay.takeOver();

    closeStorage = started.closeStorage;
    leaderStorage = started.storage;
    storageHealth = started.storageHealth;
    postLeaderStatus(service.epoch());

    for (const subscription of pending.subscriptions) {
      service.serve(tabId, subscription);
    }

    for (const call of pending.calls) {
      service.serve(tabId, call);
    }

    leader = service;
    announceLeader(service);
    service.start();
    console.log('> EngineHost -> assumeLeadership:', {
      coordination,
      epoch: service.epoch(),
      storage: started.storage,
    });
  };

  const handleLockGranted = async (): Promise<void> => {
    hasLeaderLock = true;
    relay.handleLeaderLost();
    postToChannel({ type: 'leader_lost' });
    leaderStartup = assumeLeadership().catch((error: unknown) => {
      console.log('> EngineHost -> assumeLeadership:', { error });
      hasLeaderLock = false;
      postToPort({ reason: 'start_failed', type: 'engine_unavailable' });

      if (hasTabLock) {
        postToChannel({ type: 'leader_query' });
      }

      releaseLock();
    });

    await leaderStartup;
    await lockReleased;
  };

  const requestLock = (manager: ILockManager): Promise<void> => manager
    .request(ENGINE_LOCK_NAME, { signal: lockAbort.signal }, handleLockGranted)
    .catch((error: unknown) => {
      if (!isAbortError(error)) {
        console.log('> EngineHost -> requestLock:', { error });
      }
    });

  const handleTabLockGranted = async (): Promise<void> => {
    hasTabLock = true;
    postToChannel({ type: 'leader_query' });
    await tabLockReleased;
  };

  const requestTabLock = (manager: ILockManager): Promise<void> => manager
    .request(createTabLockName(tabId), { signal: lockAbort.signal }, handleTabLockGranted)
    .catch((error: unknown) => {
      if (!isAbortError(error)) {
        console.log('> EngineHost -> requestTabLock:', { error });
      }
    });

  const startAlone = (): Promise<void> => {
    leaderStartup = assumeLeadership().catch((error: unknown) => {
      console.log('> EngineHost -> assumeLeadership:', { error });
      isEngineUnavailable = true;
      postToPort({ reason: 'start_failed', type: 'engine_unavailable' });

      for (const call of relay.takeOver().calls) {
        postToPort({ requestId: call.requestId, type: 'transport_error' });
      }
    });

    return leaderStartup;
  };

  const handlePortMessage = (event: MessageEvent): void => {
    const message = parseEngineClientMessage(event.data);

    if (message === undefined || isStopped) {
      return;
    }

    if (isEngineUnavailable) {
      if (message.type === 'control' || message.type === 'request') {
        postToPort({ requestId: message.requestId, type: 'transport_error' });
      }
    }
    else if (leader === undefined) {
      relay.handleClientMessage(message);
    }
    else {
      leader.serve(tabId, message);
    }
  };

  const handleChannelMessage = (event: MessageEvent): void => {
    const message = parseEngineBroadcastMessage(event.data, tabId);

    if (message === undefined || isStopped) {
      return;
    }

    switch (message.type) {
      case 'leader_gone':
        relay.handleLeaderGone(message.epoch);
        break;
      case 'leader_lost':
        if (leader === undefined && !hasLeaderLock) {
          relay.handleLeaderLost();
        }

        break;
      case 'leader_query':
        if (leader !== undefined) {
          announceLeader(leader);
        }

        break;
      case 'leader_ready':
        if (leader === undefined && !hasLeaderLock && hasTabLock) {
          relay.handleLeaderReady({
            epoch: message.epoch,
            storage: message.storage,
            storageHealth: message.storageHealth,
          });
        }

        break;
      case 'relay_to_leader':
        leader?.serve(message.tabId, message.message);
        break;
      case 'relay_to_tab':
        relay.handleLeaderMessage(message.message);
        break;
      case 'reset_done':
        if (leader === undefined && !hasLeaderLock) {
          relay.handleResetDone(message.epoch);
        }

        break;
    }
  };

  channel?.addEventListener('message', handleChannelMessage);
  port.addEventListener('message', handlePortMessage);
  port.start?.();
  const lockRequestsSettled = lockManager === undefined
    ? startAlone()
    : Promise.all([requestTabLock(lockManager), requestLock(lockManager)]);

  const performStop = async (): Promise<void> => {
    lockAbort.abort();
    await leaderStartup;
    port.removeEventListener('message', handlePortMessage);

    if (leader === undefined) {
      relay.stop();
    }
    else {
      const epoch = leader.epoch();
      await leader.stop();
      closeStorage();
      postToChannel({ epoch, type: 'leader_gone' });
    }

    isStopped = true;
    channel?.removeEventListener('message', handleChannelMessage);
    channel?.close();
    releaseLock();
    releaseTabLock();
    await lockRequestsSettled;
  };

  const stop = (): Promise<void> => {
    stopPromise ??= performStop();

    return stopPromise;
  };

  return { stop };
};
