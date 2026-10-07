import { vi } from 'vitest';

import type { HostFixtureValue } from './hostHarness';

import { readLastStatus } from './hostHarness';

export const WAIT_OPTIONS = { interval: 2, timeout: 3_000 } as const;

const CHANNEL_SETTLE_MS = 40;

export interface GateValue {
  open: () => void;
  promise: Promise<void>;
}

export const createGate = (): GateValue => {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { open, promise };
};

export const waitForStatusEpoch = async (
  fixture: HostFixtureValue,
  role: 'follower' | 'leader',
  epochToAvoid?: string,
): Promise<string> => {
  await vi.waitFor(() => {
    const status = readLastStatus(fixture);

    if (status?.role !== role || status.epoch === epochToAvoid) {
      throw new Error(`The host is not the ${role} of a new epoch yet`);
    }
  }, WAIT_OPTIONS);

  return readLastStatus(fixture)?.epoch ?? '';
};

export const waitForRole = async (fixture: HostFixtureValue, role: 'follower' | 'leader'): Promise<void> => {
  await vi.waitFor(() => {
    if (readLastStatus(fixture)?.role !== role) {
      throw new Error(`The host is not the ${role} yet`);
    }
  }, WAIT_OPTIONS);
};

const isMessageOfType = (data: unknown, type: string): boolean =>
  typeof data === 'object' && data !== null && 'type' in data && data.type === type;

export const waitForInbox = async (fixture: HostFixtureValue, type: string, count = 1): Promise<void> => {
  await vi.waitFor(() => {
    if (fixture.inbox.filter(data => isMessageOfType(data, type)).length < count) {
      throw new Error(`The host has not received ${type} yet`);
    }
  }, WAIT_OPTIONS);
};

export const countOutboxMessages = (fixture: HostFixtureValue, type: string, tabId?: string): number =>
  fixture.channelOutbox().filter((message) => {
    if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== type) {
      return false;
    }

    return tabId === undefined || ('tabId' in message && message.tabId === tabId);
  }).length;

export const settleChannels = (): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, CHANNEL_SETTLE_MS);
});

export const readSubscriptionId = (fixture: HostFixtureValue): string => {
  const subscribe = fixture.inbox.find(
    (data): data is { subscriptionId: string } => isMessageOfType(data, 'subscribe')
      && typeof data === 'object'
      && data !== null
      && 'subscriptionId' in data
      && typeof data.subscriptionId === 'string',
  );

  return subscribe?.subscriptionId ?? '';
};
