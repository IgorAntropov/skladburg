import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ProbeSnapshotValue } from './buildRunValue.ts';
import type {
  NetworkConditionsValue,
  RequestValue,
} from './perfTypes.ts';

import { buildRunValue } from './buildRunValue.ts';

const NETWORK: NetworkConditionsValue = { downloadBytesPerSecond: 1_000_000, latencyMs: 165, uploadBytesPerSecond: 100_000 };

const createSnapshot = (overrides: Partial<ProbeSnapshotValue> = {}): ProbeSnapshotValue => ({
  engineReadyAt: 1800,
  entryScriptUrl: null,
  fcp: 600,
  firstScreenReadyAt: 2400,
  lcp: 900,
  longTasks: [],
  resources: [],
  sceneFirstFrameAt: null,
  skeletonShownAt: 700,
  timeOrigin: 0,
  ttfb: 200,
  workerCreatedAt: 1200,
  workerMessages: [],
  ...overrides,
});

const createRequest = (overrides: Partial<RequestValue> = {}): RequestValue => ({
  bytes: 1000,
  endAt: 500,
  fromCache: false,
  startAt: 100,
  target: 'page',
  url: 'https://host/skladburg/assets/index-Ka_enA0r.js',
  ...overrides,
});

describe('buildRunValue', () => {
  it('counts requests started and bytes finished before the first screen', () => {
    const run = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [],
      requests: [
        createRequest(),
        createRequest({ bytes: 2000, endAt: 2300, startAt: 2000, url: 'https://host/b.js' }),
        createRequest({ bytes: 4000, endAt: 3100, startAt: 2300, url: 'https://host/c.js' }),
        createRequest({ bytes: 8000, endAt: 3500, startAt: 2500, url: 'https://host/d.js' }),
      ],
      snapshot: createSnapshot(),
    });

    expect(run.requestsBeforeReady).toBe(3);
    expect(run.bytesBeforeReady).toBe(3000);
  });

  it('keeps service worker traffic out of the page totals and counts it on its own', () => {
    const run = buildRunValue({
      isServiceWorkerThrottled: true,
      network: NETWORK,
      openRequests: [],
      requests: [
        createRequest(),
        createRequest({ bytes: 5000, endAt: 2200, startAt: 1800, target: 'service-worker', url: 'https://host/precache.js' }),
        createRequest({ bytes: 7000, endAt: 3000, startAt: 2300, target: 'service-worker', url: 'https://host/late.js' }),
      ],
      snapshot: createSnapshot(),
    });

    expect(run).toMatchObject({
      bytesBeforeReady: 1000,
      isServiceWorkerThrottled: true,
      requestsBeforeReady: 1,
      serviceWorkerBytesBeforeReady: 5000,
      serviceWorkerRequestsBeforeReady: 2,
    });
    expect(run.requests).toHaveLength(3);
  });

  it('carries the reason why the service worker was not confirmed as throttled only when there is one', () => {
    const withNote = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [],
      requests: [],
      serviceWorkerThrottlingNote: 'not-finished',
      snapshot: createSnapshot(),
    });
    const withoutNote = buildRunValue({
      isServiceWorkerThrottled: true,
      network: NETWORK,
      openRequests: [],
      requests: [],
      snapshot: createSnapshot(),
    });

    expect(withNote).toMatchObject({ isServiceWorkerThrottled: null, serviceWorkerThrottlingNote: 'not-finished' });
    expect(withoutNote).not.toHaveProperty('serviceWorkerThrottlingNote');
  });

  it('reports a file both the page and the service worker downloaded as a repeat, not as a duplicate', () => {
    const url = 'https://host/skladburg/assets/index-Ka_enA0r.js';
    const run = buildRunValue({
      isServiceWorkerThrottled: true,
      network: NETWORK,
      openRequests: [],
      requests: [createRequest({ url }), createRequest({ startAt: 900, target: 'service-worker', url })],
      snapshot: createSnapshot(),
    });

    expect(run.duplicates).toEqual([]);
    expect(run.serviceWorkerRepeats).toEqual([url]);
  });

  it('does not take a resource timing entry for a service worker download as known', () => {
    const url = 'https://host/skladburg/assets/worker-Bde9Yxd9.js';
    const run = buildRunValue({
      isServiceWorkerThrottled: true,
      network: NETWORK,
      openRequests: [],
      requests: [createRequest({ startAt: 900, target: 'service-worker', url })],
      snapshot: createSnapshot({
        resources: [{ encodedBodySize: 31_000, endAt: 1300, startAt: 1100, transferSize: 32_000, url }],
      }),
    });

    expect(run.requests.filter(request => request.target === 'page')).toHaveLength(1);
    expect(run.bytesBeforeReady).toBe(32_000);
  });

  it('carries probe times through and counts long tasks only before the first screen', () => {
    const run = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [],
      requests: [],
      snapshot: createSnapshot({
        longTasks: [
          { durationMs: 150, startAt: 1000 },
          { durationMs: 300, startAt: 2600 },
        ],
      }),
    });

    expect(run).toMatchObject({
      engineReady: 1800,
      fcp: 600,
      firstScreenReady: 2400,
      lcp: 900,
      longTaskCount: 1,
      longTaskExcessMs: 100,
      skeletonShown: 700,
      ttfb: 200,
      workerCreated: 1200,
    });
  });

  it('reports files downloaded twice', () => {
    const run = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [],
      requests: [createRequest(), createRequest({ target: 'worker' })],
      snapshot: createSnapshot(),
    });

    expect(run.duplicates).toEqual(['https://host/skladburg/assets/index-Ka_enA0r.js']);
  });

  it('says the worker is not throttled when its core arrived faster than the profile allows', () => {
    const run = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [],
      requests: [
        createRequest({
          bytes: 500_000,
          endAt: 1060,
          startAt: 1000,
          target: 'worker',
          url: 'https://host/skladburg/assets/engine-BYddzchM.js',
        }),
      ],
      snapshot: createSnapshot(),
    });

    expect(run.isWorkerThrottled).toBe(false);
  });

  it('marks the worker check as not applicable when the core did not come over the worker network, and only then', () => {
    const preloadedByPage = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [],
      requests: [createRequest({ url: 'https://host/skladburg/assets/engine-BYddzchM.js' })],
      snapshot: createSnapshot(),
    });
    const loadedByWorker = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [],
      requests: [
        createRequest({
          bytes: 500_000,
          endAt: 1700,
          startAt: 1000,
          target: 'worker',
          url: 'https://host/skladburg/assets/engine-BYddzchM.js',
        }),
      ],
      snapshot: createSnapshot(),
    });

    expect(preloadedByPage).toMatchObject({ isWorkerThrottled: null, workerThrottlingNote: 'no-network-load' });
    expect(loadedByWorker.isWorkerThrottled).toBe(true);
    expect(loadedByWorker).not.toHaveProperty('workerThrottlingNote');
  });

  it('leaves the counts at zero when the first screen was never reached', () => {
    const run = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [],
      requests: [createRequest()],
      snapshot: createSnapshot({ firstScreenReadyAt: null }),
    });

    expect(run).toMatchObject({ bytesBeforeReady: 0, firstScreenReady: null, longTaskCount: 0, requestsBeforeReady: 0 });
  });

  it('measures the skeleton and the first screen from the start of the entry script request', () => {
    const entryUrl = 'https://host/skladburg/assets/index-Ka_enA0r.js';
    const run = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [],
      requests: [
        createRequest({ endAt: 600, startAt: 0, url: 'https://host/skladburg/' }),
        createRequest({ bytes: 80_000, endAt: 1100, startAt: 500, url: entryUrl }),
        createRequest({ bytes: 30_000, endAt: 900, startAt: 520, url: 'https://host/skladburg/assets/mountApp-B.js' }),
      ],
      snapshot: createSnapshot({ entryScriptUrl: entryUrl, firstScreenReadyAt: 1800, skeletonShownAt: 900 }),
    });

    expect(run).toMatchObject({ entryStart: 500, firstScreenFromEntry: 1300, skeletonFromEntry: 400 });
    expect(run.entrySharingBytes).toBe(30_000);
    expect(run.entrySharingMs).toBeCloseTo(30_000 / NETWORK.downloadBytesPerSecond * 1000);
  });

  it('leaves the entry metrics empty when the entry script was never requested', () => {
    const run = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [],
      requests: [createRequest({ url: 'https://host/skladburg/assets/mountApp-B.js' })],
      snapshot: createSnapshot(),
    });

    expect(run).toMatchObject({
      entrySharingBytes: null,
      entrySharingMs: null,
      entryStart: null,
      firstScreenFromEntry: null,
      skeletonFromEntry: null,
    });
  });

  it('lists the revalidation of a file the page already loaded without counting it as a request, bytes or duplicate', () => {
    const url = 'https://host/skladburg/assets/worker-XkuRDHIr.js';
    const run = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [{ startAt: 1500, url }],
      requests: [createRequest({ bytes: 32_000, endAt: 1100, startAt: 600, url })],
      snapshot: createSnapshot({
        resources: [
          { encodedBodySize: 31_900, endAt: 1100, startAt: 602, transferSize: 32_200, url },
          { encodedBodySize: 31_900, endAt: 1900, startAt: 1505, transferSize: 300, url },
        ],
      }),
    });

    expect(run.revalidatedBeforeReady).toEqual([url]);
    expect(run.requests.filter(request => request.isRevalidated === true)).toMatchObject([{ bytes: 300, startAt: 1500 }]);
    expect(run.requestsBeforeReady).toBe(1);
    expect(run.bytesBeforeReady).toBe(32_000);
    expect(run.duplicates).toEqual([]);
  });

  it('does not list a revalidation that started after the first screen', () => {
    const url = 'https://host/skladburg/assets/worker-XkuRDHIr.js';
    const run = buildRunValue({
      isServiceWorkerThrottled: null,
      network: NETWORK,
      openRequests: [{ startAt: 2600, url }],
      requests: [],
      snapshot: createSnapshot({
        resources: [{ encodedBodySize: 31_900, endAt: 2900, startAt: 2605, transferSize: 300, url }],
      }),
    });

    expect(run.revalidatedBeforeReady).toEqual([]);
  });
});
