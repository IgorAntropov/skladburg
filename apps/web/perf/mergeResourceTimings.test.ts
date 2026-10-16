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
