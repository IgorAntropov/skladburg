import {
  describe,
  expect,
  it,
} from 'vitest';

import type { RequestValue } from './perfTypes.ts';

import { mergeResourceTimings } from './mergeResourceTimings.ts';

const createRequest = (url: string, startAt: number): RequestValue => ({
  bytes: 1000,
  endAt: startAt + 100,
  fromCache: false,
  startAt,
  target: 'page',
  url,
});

describe('mergeResourceTimings', () => {
  it('adds a resource the network log never saw finish, such as the worker script', () => {
    const merged = mergeResourceTimings(
      [createRequest('https://host/a.js', 100), createRequest('https://host/c.js', 900)],
      [],
      [{ encodedBodySize: 31_000, endAt: 700, startAt: 500, transferSize: 32_000, url: 'https://host/worker.js' }],
    );

    expect(merged.map(request => request.url)).toEqual(['https://host/a.js', 'https://host/worker.js', 'https://host/c.js']);
    expect(merged[1]).toEqual({
      bytes: 32_000,
      endAt: 700,
      fromCache: false,
      startAt: 500,
      target: 'page',
      url: 'https://host/worker.js',
    });
  });

  it('does not repeat a resource the network log already has', () => {
    const merged = mergeResourceTimings(
      [createRequest('https://host/a.js', 100)],
      [],
      [{ encodedBodySize: 4000, endAt: 300, startAt: 110, transferSize: 5000, url: 'https://host/a.js' }],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.bytes).toBe(1000);
  });

  it('treats a resource with a body but no transferred bytes as cached', () => {
    const merged = mergeResourceTimings(
      [],
      [],
      [{ encodedBodySize: 8000, endAt: 300, startAt: 110, transferSize: 0, url: 'https://host/w.js' }],
    );

    expect(merged).toMatchObject([{ bytes: 0, fromCache: true }]);
  });

  it('does not call a resource cached when the browser reported no sizes at all', () => {
    const merged = mergeResourceTimings(
      [],
      [],
      [{ encodedBodySize: 0, endAt: 300, startAt: 110, transferSize: 0, url: 'https://host/w.js' }],
    );

    expect(merged).toMatchObject([{ bytes: 0, fromCache: false }]);
  });

  it('starts a resource at the moment its request was sent when the network log saw it open', () => {
    const merged = mergeResourceTimings(
      [],
      [{ startAt: 120, url: 'https://host/worker.js' }],
      [{ encodedBodySize: 31_000, endAt: 700, startAt: 500, transferSize: 32_000, url: 'https://host/worker.js' }],
    );

    expect(merged).toMatchObject([{ endAt: 700, startAt: 120 }]);
  });
});

describe('mergeResourceTimings revalidation', () => {
  const WORKER_URL = 'https://host/worker.js';

  it('adds the second request for a known URL when it starts at another time, and marks it as a 304', () => {
    const merged = mergeResourceTimings(
      [{ ...createRequest(WORKER_URL, 660), bytes: 32_000, endAt: 1100 }],
      [{ startAt: 1400, url: WORKER_URL }],
      [
        { encodedBodySize: 31_900, endAt: 1100, startAt: 662, transferSize: 32_200, url: WORKER_URL },
        { encodedBodySize: 31_900, endAt: 1700, startAt: 1405, transferSize: 300, url: WORKER_URL },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ bytes: 32_000, startAt: 660 });
    expect(merged[0]?.isRevalidated).toBeUndefined();
    expect(merged[1]).toEqual({
      bytes: 300,
      endAt: 1700,
      fromCache: false,
      isRevalidated: true,
      startAt: 1400,
      target: 'page',
      url: WORKER_URL,
    });
  });

  it('marks a network-log request as revalidated when its timing entry shows a conditional answer', () => {
    const merged = mergeResourceTimings(
      [{ ...createRequest('https://host/a.js', 100), bytes: 310 }],
      [],
      [{ encodedBodySize: 40_000, endAt: 300, startAt: 105, transferSize: 310, url: 'https://host/a.js' }],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ bytes: 310, isRevalidated: true });
  });

  it('pairs two entries with two requests of one URL by nearest start, not by order of arrival', () => {
    const merged = mergeResourceTimings(
      [createRequest(WORKER_URL, 900), createRequest(WORKER_URL, 100)],
      [],
      [
        { encodedBodySize: 5000, endAt: 400, startAt: 104, transferSize: 5300, url: WORKER_URL },
        { encodedBodySize: 5000, endAt: 1200, startAt: 903, transferSize: 300, url: WORKER_URL },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged.map(request => request.isRevalidated)).toEqual([undefined, true]);
  });

  it('does not call a full download or a cache hit a revalidation', () => {
    const merged = mergeResourceTimings(
      [],
      [],
      [
        { encodedBodySize: 5000, endAt: 400, startAt: 100, transferSize: 5300, url: 'https://host/full.js' },
        { encodedBodySize: 5000, endAt: 400, startAt: 100, transferSize: 0, url: 'https://host/cached.js' },
      ],
    );

    expect(merged.map(request => request.isRevalidated)).toEqual([undefined, undefined]);
  });

  it('treats a far-away entry of a known URL as another request instead of dropping it', () => {
    const merged = mergeResourceTimings(
      [createRequest('https://host/a.js', 100)],
      [],
      [{ encodedBodySize: 4000, endAt: 3300, startAt: 3000, transferSize: 300, url: 'https://host/a.js' }],
    );

    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({ isRevalidated: true, startAt: 3000 });
  });
});
