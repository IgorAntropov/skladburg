import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  EngineClientMessageValue,
  EngineHostMessageValue,
  EngineRequestMessageValue,
  EngineSubscribeMessageValue,
} from '../protocol/index';

import { createFollowerRelay } from './followerRelay';
import { createFakeTimers } from './testing/fakeTimers';

const TIMEOUT_MS = 1_000;

const createRequest = (requestId: string): EngineRequestMessageValue => ({
  body: new ArrayBuffer(0),
  headers: [],
  method: 'POST',
  requestId,
  type: 'request',
  url: 'https://demo-engine.invalid/x',
});

const createSubscription = (subscriptionId: string): EngineSubscribeMessageValue => ({
  channel: 'org:o1',
  headers: [['x-demo-user-id', 'u1']],
  subscriptionId,
  type: 'subscribe',
});

const createFixture = (): {
  relay: ReturnType<typeof createFollowerRelay>;
  timers: ReturnType<typeof createFakeTimers>;
  toLeader: EngineClientMessageValue[];
  toPort: EngineHostMessageValue[];
} => {
  const timers = createFakeTimers();
  const toLeader: EngineClientMessageValue[] = [];
  const toPort: EngineHostMessageValue[] = [];
  const relay = createFollowerRelay({
    postToLeader: (message) => {
      toLeader.push(message);
    },
    postToPort: (message) => {
      toPort.push(message);
    },
    requestTimeoutMs: TIMEOUT_MS,
    timers,
  });

  return { relay, timers, toLeader, toPort };
};

describe('follower relay before a leader is known', () => {
  it('holds requests and subscriptions until the leader announces itself, then sends subscriptions first', () => {
    const { relay, toLeader, toPort } = createFixture();

    relay.handleClientMessage(createRequest('r1'));
    relay.handleClientMessage(createSubscription('s1'));
    relay.handleClientMessage({ command: 'list_personas', requestId: 'c1', type: 'control' });

    expect(toLeader).toEqual([]);

    relay.handleLeaderReady({ epoch: 'e1', storage: 'indexed-db', storageHealth: 'ok' });

    expect(toLeader.map(message => message.type)).toEqual(['subscribe', 'request', 'control']);
    expect(toPort).toEqual([
      { coordination: 'shared', epoch: 'e1', role: 'follower', storage: 'indexed-db', storageHealth: 'ok', type: 'status' },
    ]);
  });

  it('drops a queued request that is aborted before it is sent', () => {
    const { relay, toLeader } = createFixture();

    relay.handleClientMessage(createRequest('r1'));
    relay.handleClientMessage({ requestId: 'r1', type: 'abort' });
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });

    expect(toLeader).toEqual([]);
  });

  it('does not send a subscription that is removed before the leader appears', () => {
    const { relay, toLeader } = createFixture();

    relay.handleClientMessage(createSubscription('s1'));
    relay.handleClientMessage({ subscriptionId: 's1', type: 'unsubscribe' });
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });

    expect(toLeader).toEqual([]);
  });

  it('fails a queued request with a transport error when the timeout passes', () => {
    const { relay, timers, toLeader, toPort } = createFixture();

    relay.handleClientMessage(createRequest('r1'));
    timers.advance(TIMEOUT_MS);

    expect(toPort).toEqual([{ requestId: 'r1', type: 'transport_error' }]);
    expect(toLeader).toEqual([]);

    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });

    expect(toLeader).toEqual([]);
  });
});

describe('follower relay with a known leader', () => {
  it('sends calls and subscriptions at once and forwards the answers of the own calls only', () => {
    const { relay, toLeader, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    toPort.length = 0;

    relay.handleClientMessage(createRequest('r1'));
    relay.handleClientMessage(createSubscription('s1'));
    relay.handleLeaderMessage({ body: new ArrayBuffer(0), headers: [], requestId: 'r1', status: 200, type: 'response' });
    relay.handleLeaderMessage({ body: new ArrayBuffer(0), headers: [], requestId: 'r-unknown', status: 200, type: 'response' });
    relay.handleLeaderMessage({ epoch: 'e1', seq: 0n, subscriptionId: 's1', type: 'subscribed' });
    relay.handleLeaderMessage({ epoch: 'e1', seq: 0n, subscriptionId: 's-unknown', type: 'subscribed' });

    expect(toLeader.map(message => message.type)).toEqual(['request', 'subscribe']);
    expect(toPort.map(message => message.type)).toEqual(['response', 'subscribed']);
  });

  it('ignores the same epoch announced again and does not send anything twice', () => {
    const { relay, toLeader, toPort } = createFixture();
    relay.handleClientMessage(createSubscription('s1'));
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });

    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });

    expect(toLeader).toHaveLength(1);
    expect(toPort).toHaveLength(1);
  });

  it('only posts a new status when the same epoch is announced with another storage health', () => {
    const { relay, toLeader, toPort } = createFixture();
    relay.handleClientMessage(createSubscription('s1'));
    relay.handleClientMessage(createRequest('r1'));
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    toLeader.length = 0;
    toPort.length = 0;

    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'failing' });
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'failing' });
    relay.handleLeaderReady({ epoch: 'e1', storage: 'indexed-db', storageHealth: 'failing' });
    relay.handleLeaderReady({ epoch: 'e1', storage: 'indexed-db', storageHealth: 'ok' });

    expect(toLeader).toEqual([]);
    expect(toPort).toEqual([
      { coordination: 'shared', epoch: 'e1', role: 'follower', storage: 'memory', storageHealth: 'failing', type: 'status' },
      { coordination: 'shared', epoch: 'e1', role: 'follower', storage: 'indexed-db', storageHealth: 'failing', type: 'status' },
      { coordination: 'shared', epoch: 'e1', role: 'follower', storage: 'indexed-db', storageHealth: 'ok', type: 'status' },
    ]);
  });

  it('keeps the storage health in the status posted after a reset', () => {
    const { relay, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'failing' });
    toPort.length = 0;

    relay.handleResetDone('e2');

    expect(toPort[0]).toEqual({
      coordination: 'shared',
      epoch: 'e2',
      role: 'follower',
      storage: 'memory',
      storageHealth: 'failing',
      type: 'status',
    });
  });

  it('fails the calls sent to the former leader and re-subscribes at the new one', () => {
    const { relay, toLeader, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createSubscription('s1'));
    relay.handleClientMessage(createRequest('r1'));
    relay.handleClientMessage({ command: 'reset', requestId: 'c1', type: 'control' });
    toLeader.length = 0;
    toPort.length = 0;

    relay.handleLeaderReady({ epoch: 'e2', storage: 'memory', storageHealth: 'ok' });

    expect(toPort).toEqual([
      { requestId: 'r1', type: 'transport_error' },
      { requestId: 'c1', type: 'transport_error' },
      { coordination: 'shared', epoch: 'e2', role: 'follower', storage: 'memory', storageHealth: 'ok', type: 'status' },
    ]);
    expect(toLeader).toEqual([createSubscription('s1')]);
  });

  it('fails the sent calls at once when the leader is gone and holds the new calls for the next leader', () => {
    const { relay, toLeader, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createRequest('r1'));
    toLeader.length = 0;

    relay.handleLeaderGone('e1');
    relay.handleClientMessage(createRequest('r2'));

    expect(toPort).toContainEqual({ requestId: 'r1', type: 'transport_error' });
    expect(toLeader).toEqual([]);

    relay.handleLeaderReady({ epoch: 'e2', storage: 'memory', storageHealth: 'ok' });

    expect(toLeader.map(message => message.type)).toEqual(['request']);
  });

  it('fails the sent calls and forgets the leader when it is lost, whatever its epoch was', () => {
    const { relay, toLeader, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createRequest('r1'));
    relay.handleClientMessage(createSubscription('s1'));
    toLeader.length = 0;
    toPort.length = 0;

    relay.handleLeaderLost();
    relay.handleClientMessage(createRequest('r2'));
    relay.handleClientMessage(createSubscription('s2'));

    expect(toPort).toEqual([{ requestId: 'r1', type: 'transport_error' }]);
    expect(toLeader).toEqual([]);
  });

  it('hands the calls that arrive after the leader is lost to the takeover instead of failing them', () => {
    const { relay, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createRequest('sent'));
    relay.handleLeaderLost();
    relay.handleClientMessage(createRequest('queued'));
    toPort.length = 0;

    const result = relay.takeOver();

    expect(result.calls.map(call => call.requestId)).toEqual(['queued']);
    expect(toPort).toEqual([]);
  });

  it('ignores the departure of a leader it does not follow', () => {
    const { relay, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e2', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createRequest('r1'));
    toPort.length = 0;

    relay.handleLeaderGone('e1');

    expect(toPort).toEqual([]);
  });

  it('tells the leader to abort a sent request when the client aborts it or the timeout passes', () => {
    const { relay, timers, toLeader, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createRequest('r1'));
    relay.handleClientMessage(createRequest('r2'));
    toLeader.length = 0;
    toPort.length = 0;

    relay.handleClientMessage({ requestId: 'r1', type: 'abort' });
    timers.advance(TIMEOUT_MS);

    expect(toLeader).toEqual([
      { requestId: 'r1', type: 'abort' },
      { requestId: 'r2', type: 'abort' },
    ]);
    expect(toPort).toEqual([{ requestId: 'r2', type: 'transport_error' }]);
  });

  it('ignores a late answer to a request that is already finished', () => {
    const { relay, timers, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createRequest('r1'));
    timers.advance(TIMEOUT_MS);
    toPort.length = 0;

    relay.handleLeaderMessage({ body: new ArrayBuffer(0), headers: [], requestId: 'r1', status: 200, type: 'response' });

    expect(toPort).toEqual([]);
  });

  it('forwards the reset with the new epoch in the status and in the next announcements', () => {
    const { relay, toLeader, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'indexed-db', storageHealth: 'ok' });
    toPort.length = 0;

    relay.handleResetDone('e2');
    relay.handleLeaderReady({ epoch: 'e2', storage: 'indexed-db', storageHealth: 'ok' });

    expect(toPort).toEqual([
      { coordination: 'shared', epoch: 'e2', role: 'follower', storage: 'indexed-db', storageHealth: 'ok', type: 'status' },
      { epoch: 'e2', type: 'reset_done' },
    ]);
    expect(toLeader).toEqual([]);
  });

  it('sends unsubscribe for every subscription and abort for every sent request on stop', () => {
    const { relay, timers, toLeader } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createSubscription('s1'));
    relay.handleClientMessage(createRequest('r1'));
    toLeader.length = 0;

    relay.stop();

    expect(toLeader).toEqual([
      { subscriptionId: 's1', type: 'unsubscribe' },
      { requestId: 'r1', type: 'abort' },
    ]);
    expect(timers.activeCount()).toBe(0);
  });
});

describe('follower relay after the leader is lost', () => {
  it('ignores the announcement of the lost epoch and accepts a new one', () => {
    const { relay, toLeader, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createSubscription('s1'));
    relay.handleLeaderLost();
    toLeader.length = 0;
    toPort.length = 0;

    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });

    expect(toPort).toEqual([]);
    expect(toLeader).toEqual([]);

    relay.handleLeaderReady({ epoch: 'e2', storage: 'memory', storageHealth: 'ok' });

    expect(toPort.map(message => message.type)).toEqual(['status']);
    expect(toLeader).toEqual([createSubscription('s1')]);
  });

  it('keeps ignoring the lost epoch after a newer leader has been accepted and lost again', () => {
    const { relay, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleLeaderLost();
    relay.handleLeaderReady({ epoch: 'e2', storage: 'memory', storageHealth: 'ok' });
    relay.handleLeaderLost();
    toPort.length = 0;

    relay.handleLeaderReady({ epoch: 'e2', storage: 'memory', storageHealth: 'ok' });
    relay.handleLeaderReady({ epoch: 'e3', storage: 'memory', storageHealth: 'ok' });

    expect(toPort.map(message => message.type)).toEqual(['status']);
    expect(toPort[0]).toMatchObject({ epoch: 'e3' });
  });

  it('accepts any epoch when it lost the leader without knowing one', () => {
    const { relay, toPort } = createFixture();

    relay.handleLeaderLost();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });

    expect(toPort.map(message => message.type)).toEqual(['status']);
  });

  it('drops the reset and every message of a leader while no leader is known', () => {
    const { relay, toLeader, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createSubscription('s1'));
    relay.handleClientMessage(createRequest('r1'));
    relay.handleLeaderLost();
    relay.handleClientMessage(createRequest('r2'));
    toLeader.length = 0;
    toPort.length = 0;

    relay.handleResetDone('e1');
    relay.handleLeaderMessage({ body: new ArrayBuffer(0), headers: [], requestId: 'r2', status: 200, type: 'response' });
    relay.handleLeaderMessage({ epoch: 'e1', seq: 0n, subscriptionId: 's1', type: 'subscribed' });
    relay.handleLeaderMessage({ events: [], subscriptionId: 's1', type: 'events' });
    relay.handleLeaderMessage({ detail: new ArrayBuffer(0), subscriptionId: 's1', type: 'subscription_denied' });

    expect(toPort).toEqual([]);
    expect(toLeader).toEqual([]);
    expect(relay.takeOver().calls.map(call => call.requestId)).toEqual(['r2']);
  });
});

describe('follower relay takeover', () => {
  it('hands the unsent calls and the subscriptions to the new leader and fails the sent calls', () => {
    const { relay, timers, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createRequest('sent'));
    relay.handleLeaderGone('e1');
    relay.handleClientMessage(createRequest('queued'));
    relay.handleClientMessage(createSubscription('s1'));
    toPort.length = 0;

    const result = relay.takeOver();

    expect(result.calls.map(call => call.requestId)).toEqual(['queued']);
    expect(result.subscriptions.map(subscription => subscription.subscriptionId)).toEqual(['s1']);
    expect(timers.activeCount()).toBe(0);
  });

  it('fails a call sent to the former leader when no departure was announced', () => {
    const { relay, toPort } = createFixture();
    relay.handleLeaderReady({ epoch: 'e1', storage: 'memory', storageHealth: 'ok' });
    relay.handleClientMessage(createRequest('sent'));
    toPort.length = 0;

    const result = relay.takeOver();

    expect(result.calls).toEqual([]);
    expect(toPort).toEqual([{ requestId: 'sent', type: 'transport_error' }]);
  });
});
