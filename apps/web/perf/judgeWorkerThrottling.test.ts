import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  NetworkConditionsValue,
  RequestValue,
} from './perfTypes.ts';

import { judgeWorkerThrottling } from './judgeWorkerThrottling.ts';

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

describe('judgeWorkerThrottling', () => {
  it('says the worker was throttled when the core came over the network as slowly as the profile allows', () => {
    expect(judgeWorkerThrottling([createCoreRequest()], NETWORK)).toEqual({ isThrottled: true });
  });

  it('says the worker was not throttled only when the core came over the network faster than the profile allows', () => {
    expect(judgeWorkerThrottling([createCoreRequest({ endAt: 1050 })], NETWORK)).toEqual({ isThrottled: false });
  });

  it('is not applicable when the worker took the core from a cache', () => {
    expect(judgeWorkerThrottling([createCoreRequest({ bytes: 0, fromCache: true })], NETWORK)).toEqual({
      isThrottled: null,
      note: 'no-network-load',
    });
  });

  it('is not applicable when the worker never requested the core, whether the page preloaded it or not', () => {
    const preloadedByPage = createCoreRequest({ target: 'page' });

    expect(judgeWorkerThrottling([], NETWORK)).toEqual({ isThrottled: null, note: 'no-network-load' });
    expect(judgeWorkerThrottling([preloadedByPage], NETWORK)).toEqual({ isThrottled: null, note: 'no-network-load' });
  });
});
