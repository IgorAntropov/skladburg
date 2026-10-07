import {
  ENGINE_PROTOCOL_VERSION,
  ENGINE_REQUEST_TIMEOUT_MS,
} from '../protocol/index';

const ENGINE_NAME_PREFIX = 'skladburg-demo-engine';
const ENGINE_TAB_LOCK_PREFIX = `${ENGINE_NAME_PREFIX}-tab-v${String(ENGINE_PROTOCOL_VERSION)}`;

export const ENGINE_LOCK_NAME = `${ENGINE_NAME_PREFIX}-leader-v${String(ENGINE_PROTOCOL_VERSION)}`;
export const ENGINE_BROADCAST_CHANNEL_NAME = `${ENGINE_NAME_PREFIX}-v${String(ENGINE_PROTOCOL_VERSION)}`;
export const ENGINE_DATABASE_NAME = ENGINE_NAME_PREFIX;
export const TICK_INTERVAL_MS = 250;
export const CHECKPOINT_INTERVAL_MS = 5000;
export const HOST_REQUEST_TIMEOUT_MS = ENGINE_REQUEST_TIMEOUT_MS;

export const createTabLockName = (tabId: string): string => `${ENGINE_TAB_LOCK_PREFIX}:${tabId}`;
