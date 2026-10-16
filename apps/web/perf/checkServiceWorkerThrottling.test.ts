import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  NetworkConditionsValue,
  RequestValue,
} from './perfTypes.ts';

import { checkServiceWorkerThrottling } from './checkServiceWorkerThrottling.ts';

const NETWORK: NetworkConditionsValue = { downloadBytesPerSecond: 1_000_000, latencyMs: 165, uploadBytesPerSecond: 100_000 };

const createRequest = (overrides: Partial<RequestValue> = {}): RequestValue => ({
  bytes: 13_000,
  endAt: 2300,
  fromCache: false,
  startAt: 2100,
  target: 'service-worker',
  url: 'https://host/skladburg/pwa-512.png',
  ...overrides,
});

describe('checkServiceWorkerThrottling', () => {
  it('confirms throttling when every download took at least the profile latency', () => {
    expect(checkServiceWorkerThrottling([createRequest(), createRequest({ endAt: 2400, startAt: 2230 })], NETWORK)).toBe('verified');
  });

  it('flags a download that finished faster than the profile latency allows', () => {
    expect(checkServiceWorkerThrottling([createRequest(), createRequest({ endAt: 2001, startAt: 2000 })], NETWORK)).toBe('violated');
  });

  it('allows a little slack below the exact latency', () => {
    expect(checkServiceWorkerThrottling([createRequest({ endAt: 2235, startAt: 2100 })], NETWORK)).toBe('verified');
  });

  it('flags a download just under the tolerated latency', () => {
    expect(checkServiceWorkerThrottling([createRequest({ endAt: 2230, startAt: 2100 })], NETWORK)).toBe('violated');
  });

  it('ignores requests served from a cache and empty responses', () => {
    const requests = [
      createRequest({ bytes: 0, endAt: 2101, fromCache: true, startAt: 2100 }),
      createRequest({ bytes: 0, endAt: 2101, startAt: 2100 }),
    ];

    expect(checkServiceWorkerThrottling(requests, NETWORK)).toBe('unverifiable');
  });

  it('ignores requests of the page and the worker', () => {
    expect(checkServiceWorkerThrottling([createRequest({ endAt: 2101, target: 'page' })], NETWORK)).toBe('unverifiable');
  });

  it('cannot judge when the service worker sent nothing', () => {
    expect(checkServiceWorkerThrottling([], NETWORK)).toBe('unverifiable');
  });
});
