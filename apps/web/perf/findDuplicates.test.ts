import {
  describe,
  expect,
  it,
} from 'vitest';

import type { RequestValue } from './perfTypes.ts';

import { findDuplicates } from './findDuplicates.ts';

const createRequest = (overrides: Partial<RequestValue> & Pick<RequestValue, 'url'>): RequestValue => ({
  bytes: 1000,
  endAt: 200,
  fromCache: false,
  startAt: 100,
  target: 'page',
  ...overrides,
});

describe('findDuplicates', () => {
  it('lists a file downloaded twice, even by the page and the worker', () => {
    const duplicates = findDuplicates([
      createRequest({ url: 'https://host/a.js' }),
      createRequest({ target: 'worker', url: 'https://host/a.js' }),
      createRequest({ url: 'https://host/b.js' }),
    ]);

    expect(duplicates).toEqual(['https://host/a.js']);
  });

  it('ignores the second request when it was served from a cache', () => {
    const duplicates = findDuplicates([
      createRequest({ url: 'https://host/a.js' }),
      createRequest({ bytes: 0, fromCache: true, url: 'https://host/a.js' }),
    ]);

    expect(duplicates).toEqual([]);
  });

  it('ignores a request that moved no bytes', () => {
    const duplicates = findDuplicates([
      createRequest({ url: 'https://host/a.js' }),
      createRequest({ bytes: 0, url: 'https://host/a.js' }),
    ]);

    expect(duplicates).toEqual([]);
  });

  it('sorts the result', () => {
    const duplicates = findDuplicates([
      createRequest({ url: 'https://host/z.js' }),
      createRequest({ url: 'https://host/z.js' }),
      createRequest({ url: 'https://host/b.js' }),
      createRequest({ url: 'https://host/b.js' }),
    ]);

    expect(duplicates).toEqual(['https://host/b.js', 'https://host/z.js']);
  });

  it('does not count a conditional revalidation of a file as a second download', () => {
    const duplicates = findDuplicates([
      createRequest({ bytes: 32_000, url: 'https://host/worker.js' }),
      createRequest({ bytes: 300, isRevalidated: true, startAt: 900, url: 'https://host/worker.js' }),
    ]);

    expect(duplicates).toEqual([]);
  });
});
