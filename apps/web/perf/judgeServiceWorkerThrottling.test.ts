import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  NetworkConditionsValue,
  RequestValue,
} from './perfTypes.ts';

import { judgeServiceWorkerThrottling } from './judgeServiceWorkerThrottling.ts';

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

describe('judgeServiceWorkerThrottling', () => {
  it('says the service worker never appeared when no target was attached', () => {
    expect(judgeServiceWorkerThrottling({ network: NETWORK, outcomes: [], requests: [] })).toEqual({
      isThrottled: null,
      note: 'absent',
    });
  });

  it('confirms throttling when the emulation was accepted and the downloads were slow enough', () => {
    expect(judgeServiceWorkerThrottling({ network: NETWORK, outcomes: ['applied'], requests: [createRequest()] })).toEqual({
      isThrottled: true,
    });
  });

  it('confirms throttling when the service worker made no requests yet', () => {
    expect(judgeServiceWorkerThrottling({ network: NETWORK, outcomes: ['applied'], requests: [] })).toEqual({ isThrottled: true });
  });

  it('reports a real refusal of the browser as false', () => {
    expect(judgeServiceWorkerThrottling({ network: NETWORK, outcomes: ['applied', 'refused'], requests: [] })).toEqual({
      isThrottled: false,
      note: 'refused',
    });
  });

  it('does not call an unfinished preparation a refusal', () => {
    expect(judgeServiceWorkerThrottling({ network: NETWORK, outcomes: ['pending'], requests: [] })).toEqual({
      isThrottled: null,
      note: 'not-finished',
    });
  });

  it('keeps a refusal ahead of an unfinished preparation of another target', () => {
    expect(judgeServiceWorkerThrottling({ network: NETWORK, outcomes: ['pending', 'refused'], requests: [] })).toEqual({
      isThrottled: false,
      note: 'refused',
    });
  });

  it('reports false when the first downloads passed before the emulation took effect', () => {
    const requests = [createRequest({ endAt: 2282, startAt: 2281 }), createRequest()];

    expect(judgeServiceWorkerThrottling({ network: NETWORK, outcomes: ['applied'], requests })).toEqual({
      isThrottled: false,
      note: 'loaded-before-emulation',
    });
  });

  it('reports fast downloads even while another preparation is unfinished', () => {
    const requests = [createRequest({ endAt: 2282, startAt: 2281 })];

    expect(judgeServiceWorkerThrottling({ network: NETWORK, outcomes: ['applied', 'pending'], requests })).toEqual({
      isThrottled: false,
      note: 'loaded-before-emulation',
    });
  });
});
