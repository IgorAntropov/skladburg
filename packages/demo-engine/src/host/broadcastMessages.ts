import type {
  EngineClientMessageValue,
  EngineHostMessageValue,
  EngineStatusValue,
} from '../protocol/index';

import {
  ENGINE_STORAGE_HEALTHS,
  ENGINE_STORAGE_KINDS,
  parseEngineClientMessage,
  parseEngineHostMessage,
} from '../protocol/index';

export type EngineBroadcastMessageValue
  = | LeaderGoneMessageValue
    | LeaderLostMessageValue
    | LeaderQueryMessageValue
    | LeaderReadyMessageValue
    | RelayToLeaderMessageValue
    | RelayToTabMessageValue
    | ResetDoneBroadcastMessageValue;

export interface LeaderGoneMessageValue {
  epoch: string;
  type: 'leader_gone';
}

export interface LeaderLostMessageValue {
  type: 'leader_lost';
}

export interface LeaderQueryMessageValue {
  type: 'leader_query';
}

export interface LeaderReadyMessageValue {
  epoch: string;
  storage: EngineStatusValue['storage'];
  storageHealth: EngineStatusValue['storageHealth'];
  type: 'leader_ready';
}

export interface RelayToLeaderMessageValue {
  message: EngineClientMessageValue;
  tabId: string;
  type: 'relay_to_leader';
}

export interface RelayToTabMessageValue {
  message: EngineHostMessageValue;
  tabId: string;
  type: 'relay_to_tab';
}

export interface ResetDoneBroadcastMessageValue {
  epoch: string;
  type: 'reset_done';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isStorageKind = (value: unknown): value is EngineStatusValue['storage'] =>
  ENGINE_STORAGE_KINDS.some(kind => kind === value);

const isStorageHealth = (value: unknown): value is EngineStatusValue['storageHealth'] =>
  ENGINE_STORAGE_HEALTHS.some(health => health === value);

export const parseEngineBroadcastMessage = (data: unknown, ownTabId: string): EngineBroadcastMessageValue | undefined => {
  if (!isRecord(data)) {
    return undefined;
  }

  const { epoch, message, storage, storageHealth, tabId, type } = data;

  switch (type) {
    case 'leader_gone':
      return isString(epoch) ? { epoch, type } : undefined;
    case 'leader_lost':
    case 'leader_query':
      return { type };
    case 'leader_ready':
      return isString(epoch) && isStorageKind(storage) && isStorageHealth(storageHealth)
        ? { epoch, storage, storageHealth, type }
        : undefined;
    case 'relay_to_leader': {
      const clientMessage = isString(tabId) ? parseEngineClientMessage(message) : undefined;

      return isString(tabId) && clientMessage !== undefined ? { message: clientMessage, tabId, type } : undefined;
    }
    case 'relay_to_tab': {
      const hostMessage = tabId === ownTabId ? parseEngineHostMessage(message) : undefined;

      return isString(tabId) && hostMessage !== undefined ? { message: hostMessage, tabId, type } : undefined;
    }
    case 'reset_done':
      return isString(epoch) ? { epoch, type } : undefined;
    default:
      return undefined;
  }
};
