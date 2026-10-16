import {
  describe,
  expect,
  it,
} from 'vitest';

import type { RequestValue } from './perfTypes.ts';

import { findServiceWorkerRepeats } from './findServiceWorkerRepeats.ts';

const createRequest = (overrides: Partial<RequestValue> & Pick<RequestValue, 'url'>): RequestValue => ({
  bytes: 1000,
  endAt: 200,
  fromCache: false,
  startAt: 100,
  target: 'page',
  ...overrides,
});

describe('findServiceWorkerRepeats', () => {
  it('lists a file the service worker downloaded after the page or the worker had already downloaded it', () => {
    const repeats = findServiceWorkerRepeats([
      createRequest({ url: 'https://host/a.js' }),
      createRequest({ target: 'worker', url: 'https://host/b.js' }),
      createRequest({ target: 'service-worker', url: 'https://host/b.js' }),
      createRequest({ target: 'service-worker', url: 'https://host/a.js' }),
      createRequest({ target: 'service-worker', url: 'https://host/only-sw.js' }),
    ]);

    expect(repeats).toEqual(['https://host/a.js', 'https://host/b.js']);
  });

  it('ignores a service worker request answered from a cache or without bytes', () => {
    const repeats = findServiceWorkerRepeats([
      createRequest({ url: 'https://host/a.js' }),
      createRequest({ bytes: 0, fromCache: true, target: 'service-worker', url: 'https://host/a.js' }),
    ]);

    expect(repeats).toEqual([]);
  });

  it('ignores a page request answered from a cache', () => {
    const repeats = findServiceWorkerRepeats([
      createRequest({ bytes: 0, fromCache: true, url: 'https://host/a.js' }),
      createRequest({ target: 'service-worker', url: 'https://host/a.js' }),
    ]);

    expect(repeats).toEqual([]);
  });
});
