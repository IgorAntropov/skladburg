import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IDemoEngine } from '../core/engine/index';
import type {
  EngineHostMessageValue,
  HeaderPairValue,
} from '../protocol/index';
import type { ILockManager } from './hostTypes';
import type { ILeaderService } from './leaderService';

import {
  createHeaders,
  createTestEngine,
} from '../core/engine/testing/engineHarness';
import { settleMicrotasks } from '../core/engine/testing/engineHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import {
  decodeErrorDetail,
  EngineControlCommand,
} from '../protocol/index';
import { createTabLockName } from './constants';
import { createLeaderService } from './leaderService';
import { createFakeLockManager } from './testing/fakeLockManager';
import { createFakeTimers } from './testing/fakeTimers';

const OWN_TAB_ID = 'tab-own';
const TAB_ID = 'tab-1';
const OTHER_TAB_ID = 'tab-2';
const BUYER_CHANNEL = organizationChannel(SeedOrganizationId.BUYER_1);
const SELLER_CHANNEL = organizationChannel(SeedOrganizationId.SELLER_1);
const BREAKING_HEADER = 'x-test-break';
const BAD_HEADERS: HeaderPairValue[] = [['bad name', 'x']];

interface LeaderFixtureValue {
  messages: Map<string, EngineHostMessageValue[]>;
  resetEpochs: string[];
  service: ILeaderService;
}

const buyerHeaders = (): HeaderPairValue[] => [...createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1)];
const sellerHeaders = (): HeaderPairValue[] => [...createHeaders(SeedUserId.ADMIN_2, SeedOrganizationId.SELLER_1)];

const createFixture = async (
  wrapEngine: (engine: IDemoEngine) => IDemoEngine = engine => engine,
  lockManager?: ILockManager,
): Promise<LeaderFixtureValue> => {
  const { engine } = await createTestEngine();
  const messages = new Map<string, EngineHostMessageValue[]>();
  const resetEpochs: string[] = [];
  let idCounter = 0;

  const service = createLeaderService({
    checkpointIntervalMs: 5000,
    engine: wrapEngine(engine),
    generateId: () => {
      idCounter += 1;

      return `id-${String(idCounter)}`;
    },
    lockManager,
    onReset: (epoch) => {
      resetEpochs.push(epoch);
    },
    ownTabId: OWN_TAB_ID,
    sendToTab: (tabId, message) => {
      messages.set(tabId, [...messages.get(tabId) ?? [], message]);
    },
    tickIntervalMs: 250,
    timers: createFakeTimers(),
  });

  return { messages, resetEpochs, service };
};

const readTypes = (fixture: LeaderFixtureValue, tabId: string): EngineHostMessageValue['type'][] =>
  (fixture.messages.get(tabId) ?? []).map(message => message.type);

const subscribe = (
  fixture: LeaderFixtureValue,
  tabId: string,
  subscriptionId: string,
  channel: string,
  headers: HeaderPairValue[],
): void => {
  fixture.service.serve(tabId, { channel, headers, subscriptionId, type: 'subscribe' });
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('leader service with unusable subscription headers', () => {
  it('denies the subscription with a validation error and logs it once', async () => {
    const fixture = await createFixture();

    subscribe(fixture, TAB_ID, 's-bad', BUYER_CHANNEL, BAD_HEADERS);

    const [message] = fixture.messages.get(TAB_ID) ?? [];
    expect(message?.type).toBe('subscription_denied');

    if (message?.type !== 'subscription_denied') {
      throw new Error('Expected subscription_denied');
    }

    const detail = decodeErrorDetail(message.detail);
    expect(message.subscriptionId).toBe('s-bad');
    expect(detail.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(detail.params.case).toBe('validationFailed');
    expect(detail.params.value).toMatchObject({ violations: [{ fieldPath: 'headers', ruleId: 'headers.invalid' }] });
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('> EngineHost -> attachSubscription:', expect.objectContaining({ subscriptionId: 's-bad' }));
    await fixture.service.stop();
  });

  it('keeps no registry entry: the next reset neither re-issues nor re-denies it, and the others are re-issued', async () => {
    const fixture = await createFixture();
    subscribe(fixture, TAB_ID, 's-buyer', BUYER_CHANNEL, buyerHeaders());
    subscribe(fixture, TAB_ID, 's-bad', BUYER_CHANNEL, BAD_HEADERS);
    subscribe(fixture, OTHER_TAB_ID, 's-seller', SELLER_CHANNEL, sellerHeaders());
    expect(readTypes(fixture, TAB_ID)).toEqual(['subscribed', 'subscription_denied']);

    fixture.service.serve(TAB_ID, { command: EngineControlCommand.RESET, requestId: 'c-1', type: 'control' });
    await vi.waitFor(() => {
      expect(fixture.resetEpochs).toHaveLength(1);
    });

    const [epoch] = fixture.resetEpochs;
    const tabMessages = fixture.messages.get(TAB_ID) ?? [];
    const reissued = tabMessages.filter(message => message.type === 'subscribed');
    expect(reissued).toHaveLength(2);
    expect(reissued[1]).toMatchObject({ epoch, subscriptionId: 's-buyer' });
    expect(tabMessages.filter(message => message.type === 'subscription_denied')).toHaveLength(1);
    expect(fixture.messages.get(OTHER_TAB_ID)?.at(-1)).toMatchObject({ epoch, subscriptionId: 's-seller', type: 'subscribed' });
    expect(tabMessages.at(-1)).toMatchObject({ requestId: 'c-1', type: 'control_result' });
    await fixture.service.stop();
  });

  it('replaces an earlier valid subscription of the same id when the new one is unusable', async () => {
    const fixture = await createFixture();
    subscribe(fixture, TAB_ID, 's-1', BUYER_CHANNEL, buyerHeaders());

    subscribe(fixture, TAB_ID, 's-1', BUYER_CHANNEL, BAD_HEADERS);
    fixture.service.serve(TAB_ID, { command: EngineControlCommand.RESET, requestId: 'c-1', type: 'control' });
    await vi.waitFor(() => {
      expect(fixture.resetEpochs).toHaveLength(1);
    });

    expect(readTypes(fixture, TAB_ID)).toEqual(['subscribed', 'subscription_denied', 'control_result']);
    await fixture.service.stop();
  });
});

describe('leader service resubscription after a reset', () => {
  it('denies the subscription that fails to re-issue and still finishes the reset for the others', async () => {
    let isResetDone = false;
    const fixture = await createFixture(engine => ({
      ...engine,
      reset: async (epoch) => {
        await engine.reset(epoch);
        isResetDone = true;
      },
      subscribe: (channel, headers, listener) => {
        if (isResetDone && headers.has(BREAKING_HEADER)) {
          throw new Error('engine cannot subscribe');
        }

        return engine.subscribe(channel, headers, listener);
      },
    }));
    subscribe(fixture, TAB_ID, 's-buyer', BUYER_CHANNEL, buyerHeaders());
    subscribe(fixture, TAB_ID, 's-broken', BUYER_CHANNEL, [...buyerHeaders(), [BREAKING_HEADER, '1']]);
    subscribe(fixture, TAB_ID, 's-seller', SELLER_CHANNEL, sellerHeaders());

    fixture.service.serve(TAB_ID, { command: EngineControlCommand.RESET, requestId: 'c-1', type: 'control' });
    await vi.waitFor(() => {
      expect(fixture.resetEpochs).toHaveLength(1);
    });

    const [epoch] = fixture.resetEpochs;
    const messages = fixture.messages.get(TAB_ID) ?? [];
    const brokenDenialCodes: ErrorCode[] = [];
    const reissuedIds: string[] = [];

    for (const message of messages) {
      if (message.type === 'subscription_denied' && message.subscriptionId === 's-broken') {
        brokenDenialCodes.push(decodeErrorDetail(message.detail).code);
      }

      if (message.type === 'subscribed' && message.epoch === epoch) {
        reissuedIds.push(message.subscriptionId);
      }
    }

    expect(brokenDenialCodes).toEqual([ErrorCode.INTERNAL]);
    expect(reissuedIds.sort()).toEqual(['s-buyer', 's-seller']);
    expect(messages.at(-1)).toMatchObject({ requestId: 'c-1', type: 'control_result' });
    await fixture.service.stop();
  });
});

describe('leader service with an engine that cannot take the first subscription', () => {
  it('denies the subscription as an internal error, logs it once and keeps no registry entry', async () => {
    let isBroken = true;
    const fixture = await createFixture(engine => ({
      ...engine,
      subscribe: (channel, headers, listener) => {
        if (isBroken) {
          throw new Error('engine cannot subscribe');
        }

        return engine.subscribe(channel, headers, listener);
      },
    }));

    expect(() => {
      subscribe(fixture, TAB_ID, 's-1', BUYER_CHANNEL, buyerHeaders());
    }).not.toThrow();

    const [message] = fixture.messages.get(TAB_ID) ?? [];

    if (message?.type !== 'subscription_denied') {
      throw new Error('Expected subscription_denied');
    }

    expect(message.subscriptionId).toBe('s-1');
    expect(decodeErrorDetail(message.detail).code).toBe(ErrorCode.INTERNAL);
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('> EngineHost -> attachSubscription:', expect.objectContaining({ subscriptionId: 's-1' }));

    isBroken = false;
    fixture.service.serve(TAB_ID, { command: EngineControlCommand.RESET, requestId: 'c-1', type: 'control' });
    await vi.waitFor(() => {
      expect(fixture.resetEpochs).toHaveLength(1);
    });

    expect(readTypes(fixture, TAB_ID)).toEqual(['subscription_denied', 'control_result']);
    await fixture.service.stop();
  });
});

describe('leader service watching the lock of a foreign tab', () => {
  const createEngineWithSubscriptionCounter = (): { activeCount: () => number; wrap: (engine: IDemoEngine) => IDemoEngine } => {
    let activeCount = 0;

    return {
      activeCount: () => activeCount,
      wrap: engine => ({
        ...engine,
        subscribe: (channel, headers, listener) => {
          const result = engine.subscribe(channel, headers, listener);

          if (result.kind === 'denied') {
            return result;
          }

          activeCount += 1;

          return {
            ...result,
            unsubscribe: () => {
              activeCount -= 1;
              result.unsubscribe();
            },
          };
        },
      }),
    };
  };

  it('waits for the lock of the tab once, on its first message, and never for the own tab', async () => {
    const lockManager = createFakeLockManager();
    const fixture = await createFixture(engine => engine, lockManager);

    subscribe(fixture, OWN_TAB_ID, 's-own', BUYER_CHANNEL, buyerHeaders());
    expect(lockManager.requestedNames()).toEqual([]);

    lockManager.occupy(createTabLockName(TAB_ID));
    subscribe(fixture, TAB_ID, 's-1', BUYER_CHANNEL, buyerHeaders());
    subscribe(fixture, TAB_ID, 's-2', BUYER_CHANNEL, buyerHeaders());
    fixture.service.serve(TAB_ID, { requestId: 'r-1', type: 'abort' });
    fixture.service.serve(TAB_ID, { subscriptionId: 's-2', type: 'unsubscribe' });
    await settleMicrotasks();

    expect(lockManager.requestedNames().filter(name => name === createTabLockName(TAB_ID))).toHaveLength(2);
    expect(lockManager.waitingCount(createTabLockName(TAB_ID))).toBe(1);
    await fixture.service.stop();
  });

  it('drops the subscriptions of the tab when its lock is granted and logs the drop once', async () => {
    const lockManager = createFakeLockManager();
    const counter = createEngineWithSubscriptionCounter();
    const fixture = await createFixture(counter.wrap, lockManager);
    const releaseTab = lockManager.occupy(createTabLockName(TAB_ID));
    const releaseOtherTab = lockManager.occupy(createTabLockName(OTHER_TAB_ID));
    subscribe(fixture, TAB_ID, 's-1', BUYER_CHANNEL, buyerHeaders());
    subscribe(fixture, TAB_ID, 's-2', BUYER_CHANNEL, buyerHeaders());
    subscribe(fixture, OTHER_TAB_ID, 's-3', BUYER_CHANNEL, buyerHeaders());
    expect(counter.activeCount()).toBe(3);

    releaseTab();
    await settleMicrotasks();

    expect(counter.activeCount()).toBe(1);
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('> EngineHost -> dropTab:', {
      abortedCallCount: 0,
      droppedSubscriptionCount: 2,
      tabId: TAB_ID,
    });
    expect(lockManager.isHeld(createTabLockName(TAB_ID))).toBe(false);

    releaseOtherTab();
    await settleMicrotasks();

    expect(counter.activeCount()).toBe(0);
    await fixture.service.stop();
  });

  it('drops silently the tab that left cleanly: nothing left to drop, nothing logged', async () => {
    const lockManager = createFakeLockManager();
    const counter = createEngineWithSubscriptionCounter();
    const fixture = await createFixture(counter.wrap, lockManager);
    const releaseTab = lockManager.occupy(createTabLockName(TAB_ID));
    subscribe(fixture, TAB_ID, 's-1', BUYER_CHANNEL, buyerHeaders());
    fixture.service.serve(TAB_ID, { subscriptionId: 's-1', type: 'unsubscribe' });

    releaseTab();
    await settleMicrotasks();

    expect(counter.activeCount()).toBe(0);
    expect(console.log).not.toHaveBeenCalled();
    expect(lockManager.waitingCount(createTabLockName(TAB_ID))).toBe(0);
    await fixture.service.stop();
  });

  it('marks the calls of the dropped tab as aborted: the answer is never sent', async () => {
    const lockManager = createFakeLockManager();
    let openHandle: () => void = () => undefined;
    const handleGate = new Promise<void>((resolve) => {
      openHandle = resolve;
    });
    const fixture = await createFixture(engine => ({
      ...engine,
      handle: async (request) => {
        await handleGate;

        return engine.handle(request);
      },
    }), lockManager);
    const releaseTab = lockManager.occupy(createTabLockName(TAB_ID));
    fixture.service.serve(TAB_ID, {
      body: new ArrayBuffer(0),
      headers: [],
      method: 'POST',
      requestId: 'r-1',
      type: 'request',
      url: 'https://demo-engine.invalid/x',
    });

    releaseTab();
    await settleMicrotasks();
    openHandle();
    await settleMicrotasks();
    await settleMicrotasks();

    expect(fixture.messages.get(TAB_ID) ?? []).toEqual([]);
    expect(console.log).toHaveBeenCalledWith('> EngineHost -> dropTab:', {
      abortedCallCount: 1,
      droppedSubscriptionCount: 0,
      tabId: TAB_ID,
    });
    await fixture.service.stop();
  });

  it('cancels every waiting request for a tab lock when the service stops, without logging an error', async () => {
    const lockManager = createFakeLockManager();
    const fixture = await createFixture(engine => engine, lockManager);
    lockManager.occupy(createTabLockName(TAB_ID));
    lockManager.occupy(createTabLockName(OTHER_TAB_ID));
    subscribe(fixture, TAB_ID, 's-1', BUYER_CHANNEL, buyerHeaders());
    subscribe(fixture, OTHER_TAB_ID, 's-2', BUYER_CHANNEL, buyerHeaders());
    await settleMicrotasks();

    expect(lockManager.waitingCount(createTabLockName(TAB_ID))).toBe(1);

    await fixture.service.stop();
    await settleMicrotasks();

    expect(lockManager.waitingCount(createTabLockName(TAB_ID))).toBe(0);
    expect(lockManager.waitingCount(createTabLockName(OTHER_TAB_ID))).toBe(0);
    expect(console.log).not.toHaveBeenCalled();
  });

  it('watches nothing without a lock manager', async () => {
    const fixture = await createFixture();

    subscribe(fixture, TAB_ID, 's-1', BUYER_CHANNEL, buyerHeaders());

    expect(readTypes(fixture, TAB_ID)).toEqual(['subscribed']);
    await fixture.service.stop();
  });
});
