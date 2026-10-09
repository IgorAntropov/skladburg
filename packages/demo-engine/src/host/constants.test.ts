import {
  describe,
  expect,
  it,
} from 'vitest';

import { ENGINE_PROTOCOL_VERSION } from '../protocol/index';
import {
  createTabLockName,
  ENGINE_BROADCAST_CHANNEL_NAME,
  ENGINE_DATABASE_NAME,
  ENGINE_LOCK_NAME,
} from './constants';

const VERSION_SUFFIX = `v${String(ENGINE_PROTOCOL_VERSION)}`;

describe('engine protocol version', () => {
  it('is version 3 since the persona list carries the customer and supplier kinds', () => {
    expect(ENGINE_PROTOCOL_VERSION).toBe(3);
  });
});

describe('engine names', () => {
  it.each([
    ['leader lock', ENGINE_LOCK_NAME],
    ['broadcast channel', ENGINE_BROADCAST_CHANNEL_NAME],
    ['tab lock', createTabLockName('tab-1')],
  ])('carries the protocol version in the %s name', (_label, name) => {
    expect(name).toContain(VERSION_SUFFIX);
  });

  it('keeps the database name free of the protocol version', () => {
    expect(ENGINE_DATABASE_NAME).not.toContain(VERSION_SUFFIX);
  });

  it('differs between the leader lock, the channel, the tab lock and the database', () => {
    const names = [ENGINE_LOCK_NAME, ENGINE_BROADCAST_CHANNEL_NAME, createTabLockName('tab-1'), ENGINE_DATABASE_NAME];

    expect(new Set(names).size).toBe(names.length);
  });

  it('separates the tab locks of different tabs', () => {
    expect(createTabLockName('tab-1')).not.toBe(createTabLockName('tab-2'));
    expect(createTabLockName('tab-1')).toContain('tab-1');
  });
});
