import {
  describe,
  expect,
  it,
} from 'vitest';

import { createRequestRecorder } from './createRequestRecorder.ts';
import { routeNetworkEvent } from './routeNetworkEvent.ts';

const TIME_ORIGIN_MS = 1_700_000_000_000;
const WALL_SECONDS = TIME_ORIGIN_MS / 1000;

describe('routeNetworkEvent', () => {
  it('feeds a full request life from protocol events into the recorder', () => {
    const recorder = createRequestRecorder('worker');

    routeNetworkEvent(recorder, 'Network.requestWillBeSent', {
      request: { url: 'https://host/skladburg/assets/engine-BYddzchM.js' },
      requestId: '7',
      timestamp: 10,
      wallTime: WALL_SECONDS + 1,
    });
    routeNetworkEvent(recorder, 'Network.responseReceived', { requestId: '7', response: { fromDiskCache: false } });
    routeNetworkEvent(recorder, 'Network.loadingFinished', { encodedDataLength: 2048, requestId: '7', timestamp: 10.5 });

    const [request] = recorder.toRequests(TIME_ORIGIN_MS);

    expect(request).toMatchObject({ bytes: 2048, fromCache: false, startAt: 1000, target: 'worker' });
    expect(request?.endAt).toBeCloseTo(1500);
  });

  it('reads a service worker answer as cached', () => {
    const recorder = createRequestRecorder('page');

    routeNetworkEvent(recorder, 'Network.requestWillBeSent', {
      request: { url: 'https://host/a.js' },
      requestId: '1',
      timestamp: 1,
      wallTime: WALL_SECONDS,
    });
    routeNetworkEvent(recorder, 'Network.responseReceived', { requestId: '1', response: { fromServiceWorker: true } });
    routeNetworkEvent(recorder, 'Network.loadingFinished', { encodedDataLength: 90, requestId: '1', timestamp: 1.1 });

    expect(recorder.toRequests(TIME_ORIGIN_MS)).toMatchObject([{ bytes: 0, fromCache: true }]);
  });

  it('drops a failed request and ignores unrelated events', () => {
    const recorder = createRequestRecorder('page');

    routeNetworkEvent(recorder, 'Network.requestWillBeSent', {
      request: { url: 'https://host/a.js' },
      requestId: '1',
      timestamp: 1,
      wallTime: WALL_SECONDS,
    });
    routeNetworkEvent(recorder, 'Network.loadingFailed', { requestId: '1' });
    routeNetworkEvent(recorder, 'Page.frameNavigated', {});

    expect(recorder.toRequests(TIME_ORIGIN_MS)).toEqual([]);
  });

  it('passes the protocol of the answer to the recorder', () => {
    const recorder = createRequestRecorder('page');

    routeNetworkEvent(recorder, 'Network.requestWillBeSent', {
      request: { url: 'https://host/skladburg/' },
      requestId: '1',
      timestamp: 1,
      wallTime: WALL_SECONDS,
    });
    routeNetworkEvent(recorder, 'Network.responseReceived', { requestId: '1', response: { protocol: 'h2' } });

    expect(recorder.readFirstProtocol()).toBe('h2');
  });
});
