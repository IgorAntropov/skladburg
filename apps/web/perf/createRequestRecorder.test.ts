import {
  describe,
  expect,
  it,
} from 'vitest';

import { createRequestRecorder } from './createRequestRecorder.ts';

const TIME_ORIGIN_MS = 1_700_000_000_000;
const WALL_SECONDS = TIME_ORIGIN_MS / 1000;

describe('createRequestRecorder', () => {
  it('turns a finished request into times from the navigation start', () => {
    const recorder = createRequestRecorder('page');

    recorder.start({ requestId: '1', timestamp: 50, url: 'https://host/a.js', wallTime: WALL_SECONDS + 0.25 });
    recorder.respond({ isFromCache: false, requestId: '1' });
    recorder.finish({ encodedDataLength: 4096, requestId: '1', timestamp: 50.4 });

    const [request] = recorder.toRequests(TIME_ORIGIN_MS);

    expect(request).toMatchObject({ bytes: 4096, fromCache: false, startAt: 250, target: 'page', url: 'https://host/a.js' });
    expect(request?.endAt).toBeCloseTo(650);
  });

  it('marks a request answered by the disk cache or a service worker as cached and drops its bytes', () => {
    const recorder = createRequestRecorder('worker');

    recorder.start({ requestId: '1', timestamp: 1, url: 'https://host/a.js', wallTime: WALL_SECONDS + 1 });
    recorder.respond({ isFromCache: true, requestId: '1' });
    recorder.finish({ encodedDataLength: 300, requestId: '1', timestamp: 1.01 });

    expect(recorder.toRequests(TIME_ORIGIN_MS)).toMatchObject([{ bytes: 0, fromCache: true, target: 'worker' }]);
  });

  it('marks a request served from the memory cache', () => {
    const recorder = createRequestRecorder('page');

    recorder.start({ requestId: '1', timestamp: 1, url: 'https://host/a.js', wallTime: WALL_SECONDS + 1 });
    recorder.markServedFromCache('1');
    recorder.respond({ isFromCache: false, requestId: '1' });
    recorder.finish({ encodedDataLength: 0, requestId: '1', timestamp: 1.001 });

    expect(recorder.toRequests(TIME_ORIGIN_MS)).toMatchObject([{ fromCache: true }]);
  });

  it('drops requests that failed, never finished, or are not http', () => {
    const recorder = createRequestRecorder('page');

    recorder.start({ requestId: 'failed', timestamp: 1, url: 'https://host/a.js', wallTime: WALL_SECONDS });
    recorder.fail('failed');
    recorder.start({ requestId: 'open', timestamp: 1, url: 'https://host/b.js', wallTime: WALL_SECONDS });
    recorder.start({ requestId: 'data', timestamp: 1, url: 'data:text/plain,x', wallTime: WALL_SECONDS });
    recorder.finish({ encodedDataLength: 1, requestId: 'data', timestamp: 2 });

    expect(recorder.toRequests(TIME_ORIGIN_MS)).toEqual([]);
  });

  it('lists requests that have not finished with their start time', () => {
    const recorder = createRequestRecorder('page');

    recorder.start({ requestId: 'open', timestamp: 4, url: 'https://host/worker.js', wallTime: WALL_SECONDS + 0.5 });
    recorder.start({ requestId: 'done', timestamp: 5, url: 'https://host/a.js', wallTime: WALL_SECONDS + 0.6 });
    recorder.finish({ encodedDataLength: 10, requestId: 'done', timestamp: 5.1 });

    expect(recorder.toOpenRequests(TIME_ORIGIN_MS)).toEqual([{ startAt: 500, url: 'https://host/worker.js' }]);
  });

  it('orders requests by start time', () => {
    const recorder = createRequestRecorder('page');

    recorder.start({ requestId: 'late', timestamp: 9, url: 'https://host/late.js', wallTime: WALL_SECONDS + 2 });
    recorder.finish({ encodedDataLength: 1, requestId: 'late', timestamp: 9.1 });
    recorder.start({ requestId: 'early', timestamp: 3, url: 'https://host/early.js', wallTime: WALL_SECONDS + 1 });
    recorder.finish({ encodedDataLength: 1, requestId: 'early', timestamp: 3.1 });

    expect(recorder.toRequests(TIME_ORIGIN_MS).map(request => request.url)).toEqual([
      'https://host/early.js',
      'https://host/late.js',
    ]);
  });

  it('reports the protocol of the first answered request and ignores empty ones', () => {
    const recorder = createRequestRecorder('page');

    recorder.start({ requestId: '1', timestamp: 1, url: 'https://host/', wallTime: WALL_SECONDS });
    recorder.start({ requestId: '2', timestamp: 2, url: 'https://host/a.js', wallTime: WALL_SECONDS + 1 });
    recorder.respond({ isFromCache: false, protocol: '', requestId: '1' });
    recorder.respond({ isFromCache: false, protocol: 'h2', requestId: '2' });

    expect(recorder.readFirstProtocol()).toBe('h2');
  });

  it('reports no protocol before any answer', () => {
    const recorder = createRequestRecorder('page');

    recorder.start({ requestId: '1', timestamp: 1, url: 'https://host/', wallTime: WALL_SECONDS });

    expect(recorder.readFirstProtocol()).toBeUndefined();
  });
});
