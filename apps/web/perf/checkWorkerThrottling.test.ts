import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  NetworkConditionsValue,
  RequestValue,
} from './perfTypes.ts';

import { checkWorkerThrottling } from './checkWorkerThrottling.ts';

const NETWORK: NetworkConditionsValue = { downloadBytesPerSecond: 1_000_000, latencyMs: 165, uploadBytesPerSecond: 100_000 };

const createCoreRequest = (overrides: Partial<RequestValue> = {}): RequestValue => ({
  bytes: 500_000,
  endAt: 1700,
  fromCache: false,
  startAt: 1000,
  target: 'worker',
  url: 'https://host/skladburg/assets/engine-BYddzchM.js',
  ...overrides,
});

describe('checkWorkerThrottling', () => {
  it('confirms throttling when the core took at least the latency plus size divided by throughput', () => {
    expect(checkWorkerThrottling([createCoreRequest()], NETWORK)).toBe('verified');
  });

  it('flags a core that arrived much faster than the profile allows', () => {
    expect(checkWorkerThrottling([createCoreRequest({ endAt: 1050 })], NETWORK)).toBe('violated');
  });

  it('allows a little slack below the exact transfer time', () => {
    expect(checkWorkerThrottling([createCoreRequest({ endAt: 1560 })], NETWORK)).toBe('verified');
  });

  it('does not accept a core that took only the pure transfer time without the latency', () => {
    expect(checkWorkerThrottling([createCoreRequest({ endAt: 1500 })], NETWORK)).toBe('violated');
  });

  it('cannot judge when the core came from a cache', () => {
    expect(checkWorkerThrottling([createCoreRequest({ bytes: 0, fromCache: true })], NETWORK)).toBe('unverifiable');
  });

  it('cannot judge when the worker never requested the core', () => {
    expect(checkWorkerThrottling([], NETWORK)).toBe('unverifiable');
  });

  it('ignores a core request made by the page', () => {
    expect(checkWorkerThrottling([createCoreRequest({ target: 'page' })], NETWORK)).toBe('unverifiable');
  });
});
