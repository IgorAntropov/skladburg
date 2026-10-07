import type {
  EngineClientMessageValue,
  EngineControlMessageValue,
  EngineHostMessageValue,
  EngineRequestMessageValue,
  EngineStatusValue,
  EngineSubscribeMessageValue,
} from '../protocol/index';
import type { ITimerSource } from './hostTypes';

export interface CreateFollowerRelayOptionsValue {
  postToLeader: (message: EngineClientMessageValue) => void;
  postToPort: (message: EngineHostMessageValue) => void;
  requestTimeoutMs: number;
  timers: ITimerSource;
}

export interface IFollowerRelay {
  handleClientMessage: (message: EngineClientMessageValue) => void;
  handleLeaderGone: (epoch: string) => void;
  handleLeaderLost: () => void;
  handleLeaderMessage: (message: EngineHostMessageValue) => void;
  handleLeaderReady: (leader: KnownLeaderValue) => void;
  handleResetDone: (epoch: string) => void;
  stop: () => void;
  takeOver: () => RelayTakeOverValue;
}

export interface KnownLeaderValue {
  epoch: string;
  storage: EngineStatusValue['storage'];
  storageHealth: EngineStatusValue['storageHealth'];
}

export interface RelayTakeOverValue {
  calls: (EngineControlMessageValue | EngineRequestMessageValue)[];
  subscriptions: EngineSubscribeMessageValue[];
}

type RelayCallMessageValue = EngineControlMessageValue | EngineRequestMessageValue;

interface RelayCallValue {
  cancelTimeout: () => void;
  isSent: boolean;
  message: RelayCallMessageValue;
}

export const createFollowerRelay = (options: CreateFollowerRelayOptionsValue): IFollowerRelay => {
  const { postToLeader, postToPort } = options;
  const calls = new Map<string, RelayCallValue>();
  const subscriptions = new Map<string, EngineSubscribeMessageValue>();
  let leader: KnownLeaderValue | undefined;
  let lostEpoch: string | undefined;

  const failCall = (requestId: string): void => {
    const call = calls.get(requestId);

    if (call === undefined) {
      return;
    }

    call.cancelTimeout();
    calls.delete(requestId);
    postToPort({ requestId, type: 'transport_error' });
  };

  const failSentCalls = (): void => {
    for (const [requestId, call] of [...calls]) {
      if (call.isSent) {
        failCall(requestId);
      }
    }
  };

  const dropCall = (requestId: string): RelayCallValue | undefined => {
    const call = calls.get(requestId);

    if (call !== undefined) {
      call.cancelTimeout();
      calls.delete(requestId);
    }

    return call;
  };

  const addCall = (message: RelayCallMessageValue): void => {
    const { requestId } = message;
    const isSent = leader !== undefined;

    const handleTimeout = (): void => {
      const call = calls.get(requestId);

      if (call?.isSent === true) {
        postToLeader({ requestId, type: 'abort' });
      }

      failCall(requestId);
    };

    calls.set(requestId, {
      cancelTimeout: options.timers.setTimeout(handleTimeout, options.requestTimeoutMs),
      isSent,
      message,
    });

    if (isSent) {
      postToLeader(message);
    }
  };

  const handleClientMessage = (message: EngineClientMessageValue): void => {
    switch (message.type) {
      case 'abort': {
        const call = dropCall(message.requestId);

        if (call?.isSent === true) {
          postToLeader(message);
        }

        break;
      }
      case 'control':
      case 'request':
        addCall(message);
        break;
      case 'subscribe':
        subscriptions.set(message.subscriptionId, message);

        if (leader !== undefined) {
          postToLeader(message);
        }

        break;
      case 'unsubscribe':
        if (subscriptions.delete(message.subscriptionId) && leader !== undefined) {
          postToLeader(message);
        }

        break;
    }
  };

  const postStatus = (known: KnownLeaderValue): void => {
    postToPort({
      coordination: 'shared',
      epoch: known.epoch,
      role: 'follower',
      storage: known.storage,
      storageHealth: known.storageHealth,
      type: 'status',
    });
  };

  const handleLeaderReady = (nextLeader: KnownLeaderValue): void => {
    if (nextLeader.epoch === lostEpoch) {
      return;
    }

    if (leader?.epoch === nextLeader.epoch) {
      if (leader.storage !== nextLeader.storage || leader.storageHealth !== nextLeader.storageHealth) {
        leader = nextLeader;
        postStatus(nextLeader);
      }

      return;
    }

    leader = nextLeader;
    failSentCalls();
    postStatus(nextLeader);

    for (const subscription of subscriptions.values()) {
      postToLeader(subscription);
    }

    for (const call of calls.values()) {
      call.isSent = true;
      postToLeader(call.message);
    }
  };

  const handleLeaderGone = (epoch: string): void => {
    if (leader?.epoch === epoch) {
      leader = undefined;
      failSentCalls();
    }
  };

  const handleLeaderLost = (): void => {
    if (leader !== undefined) {
      lostEpoch = leader.epoch;
    }

    leader = undefined;
    failSentCalls();
  };

  const handleResetDone = (epoch: string): void => {
    if (leader === undefined) {
      return;
    }

    leader = { ...leader, epoch };
    postStatus(leader);
    postToPort({ epoch, type: 'reset_done' });
  };

  const handleLeaderMessage = (message: EngineHostMessageValue): void => {
    if (leader === undefined) {
      return;
    }

    switch (message.type) {
      case 'control_result':
      case 'response':
      case 'transport_error':
        if (dropCall(message.requestId) !== undefined) {
          postToPort(message);
        }

        break;
      case 'engine_unavailable':
      case 'reset_done':
      case 'status':
        break;
      case 'events':
      case 'subscribed':
      case 'subscription_denied':
        if (subscriptions.has(message.subscriptionId)) {
          postToPort(message);
        }

        break;
    }
  };

  const takeOver = (): RelayTakeOverValue => {
    failSentCalls();
    const pendingCalls = [...calls.values()].map(call => call.message);
    const pendingSubscriptions = [...subscriptions.values()];

    for (const call of calls.values()) {
      call.cancelTimeout();
    }

    calls.clear();
    subscriptions.clear();
    leader = undefined;

    return { calls: pendingCalls, subscriptions: pendingSubscriptions };
  };

  const stop = (): void => {
    if (leader !== undefined) {
      for (const subscriptionId of subscriptions.keys()) {
        postToLeader({ subscriptionId, type: 'unsubscribe' });
      }

      for (const [requestId, call] of calls) {
        if (call.isSent) {
          postToLeader({ requestId, type: 'abort' });
        }
      }
    }

    for (const call of calls.values()) {
      call.cancelTimeout();
    }

    calls.clear();
    subscriptions.clear();
    leader = undefined;
  };

  return {
    handleClientMessage,
    handleLeaderGone,
    handleLeaderLost,
    handleLeaderMessage,
    handleLeaderReady,
    handleResetDone,
    stop,
    takeOver,
  };
};
