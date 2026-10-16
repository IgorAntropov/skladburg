import {
  describe,
  expect,
  it,
} from 'vitest';

import type { RequestValue } from './perfTypes.ts';

import {
  findEntryRequest,
  measureFromEntry,
} from './findEntryRequest.ts';

const createRequest = (url: string, startAt: number, overrides: Partial<RequestValue> = {}): RequestValue => ({
  bytes: 1000,
  endAt: startAt + 100,
  fromCache: false,
  startAt,
  target: 'page',
  url,
  ...overrides,
});

const ENTRY_URL = 'https://host/skladburg/assets/index-Ka_enA0r.js';

describe('findEntryRequest', () => {
  it('finds the script the document names, even when its file name does not follow the usual pattern', () => {
    const entry = findEntryRequest(
      [createRequest('https://host/skladburg/assets/index-old.js', 5), createRequest('https://host/skladburg/assets/main-X.js', 20)],
      'https://host/skladburg/assets/main-X.js',
    );

    expect(entry?.startAt).toBe(20);
  });

  it('falls back to the entry file name pattern, ignoring style sheets and other chunks', () => {
    const entry = findEntryRequest(
      [
        createRequest('https://host/skladburg/assets/index-Bxhqw5mi.css', 5),
        createRequest('https://host/skladburg/assets/mountApp-B.js', 8),
        createRequest(ENTRY_URL, 30),
      ],
      null,
    );

    expect(entry?.url).toBe(ENTRY_URL);
  });

  it('takes the earliest page request and skips revalidations and worker requests', () => {
    const entry = findEntryRequest(
      [
        createRequest(ENTRY_URL, 10, { target: 'worker' }),
        createRequest(ENTRY_URL, 15, { isRevalidated: true }),
        createRequest(ENTRY_URL, 90),
        createRequest(ENTRY_URL, 40),
      ],
      ENTRY_URL,
    );

    expect(entry?.startAt).toBe(40);
  });

  it('finds nothing without an entry request', () => {
    expect(findEntryRequest([createRequest('https://host/skladburg/assets/mountApp-B.js', 8)], undefined)).toBeUndefined();
  });
});

describe('measureFromEntry', () => {
  it('measures from the entry request start and stays empty without the moment or the entry', () => {
    const entry = createRequest(ENTRY_URL, 600);

    expect(measureFromEntry(1000, entry)).toBe(400);
    expect(measureFromEntry(null, entry)).toBeNull();
    expect(measureFromEntry(1000, undefined)).toBeNull();
  });
});
