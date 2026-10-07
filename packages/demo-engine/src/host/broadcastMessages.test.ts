import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { parseEngineBroadcastMessage } from './broadcastMessages';

const OWN_TAB = 'tab-own';
const OTHER_TAB = 'tab-other';

const parse = (data: unknown): ReturnType<typeof parseEngineBroadcastMessage> => parseEngineBroadcastMessage(data, OWN_TAB);

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseEngineBroadcastMessage', () => {
  it('accepts the leader messages', () => {
    expect(parse({ type: 'leader_query' })).toEqual({ type: 'leader_query' });
    expect(parse({ type: 'leader_lost' })).toEqual({ type: 'leader_lost' });
    expect(parse({ epoch: 'e1', storage: 'memory', storageHealth: 'failing', type: 'leader_ready' })).toEqual({
      epoch: 'e1',
      storage: 'memory',
      storageHealth: 'failing',
      type: 'leader_ready',
    });
    expect(parse({ epoch: 'e1', type: 'leader_gone' })).toEqual({ epoch: 'e1', type: 'leader_gone' });
    expect(parse({ epoch: 'e2', type: 'reset_done' })).toEqual({ epoch: 'e2', type: 'reset_done' });
  });

  it('does not carry an epoch in the lost leader message', () => {
    expect(parse({ epoch: 'e1', type: 'leader_lost' })).toEqual({ type: 'leader_lost' });
  });

  it('accepts a client message relayed to the leader from any tab', () => {
    const message = { requestId: 'r1', type: 'abort' };

    expect(parse({ message, tabId: OTHER_TAB, type: 'relay_to_leader' })).toEqual({
      message,
      tabId: OTHER_TAB,
      type: 'relay_to_leader',
    });
  });

  it('accepts a host message relayed to the own tab', () => {
    const message = { epoch: 'e1', seq: 3n, subscriptionId: 's1', type: 'subscribed' };

    expect(parse({ message, tabId: OWN_TAB, type: 'relay_to_tab' })).toEqual({
      message,
      tabId: OWN_TAB,
      type: 'relay_to_tab',
    });
  });

  it('ignores a host message relayed to another tab without logging', () => {
    const message = { epoch: 'e1', seq: 3n, subscriptionId: 's1', type: 'subscribed' };

    expect(parse({ message, tabId: OTHER_TAB, type: 'relay_to_tab' })).toBeUndefined();
    expect(console.log).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    'leader_query',
    [],
    {},
    { type: 'unknown' },
    { epoch: 1, type: 'leader_gone' },
    { epoch: 'e1', storage: 'disk', storageHealth: 'ok', type: 'leader_ready' },
    { epoch: 'e1', storage: 'memory', storageHealth: 'broken', type: 'leader_ready' },
    { epoch: 'e1', storage: 'memory', type: 'leader_ready' },
    { epoch: 'e1', type: 'leader_ready' },
    { message: { requestId: 'r1', type: 'abort' }, type: 'relay_to_leader' },
    { message: { type: 'abort' }, tabId: OTHER_TAB, type: 'relay_to_leader' },
    { message: { requestId: 'r1', type: 'transport_error' }, tabId: OWN_TAB, type: 'relay_to_leader' },
    { message: { type: 'transport_error' }, tabId: OWN_TAB, type: 'relay_to_tab' },
    { message: { requestId: 'r1', type: 'abort' }, tabId: OWN_TAB, type: 'relay_to_tab' },
    { epoch: 2, type: 'reset_done' },
  ])('ignores a malformed message %#', (data) => {
    expect(parse(data)).toBeUndefined();
  });
});
