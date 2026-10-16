import {
  describe,
  expect,
  it,
} from 'vitest';

import type { RequestValue } from './perfTypes.ts';

import { estimateEntrySharing } from './estimateEntrySharing.ts';

const BASE = 'https://host/skladburg';
const BYTES_PER_SECOND = 1_000_000;
const LATENCY_MS = 100;

const createRequest = (path: string, startAt: number, bytes: number, overrides: Partial<RequestValue> = {}): RequestValue => ({
  bytes,
  endAt: startAt + 300,
  fromCache: false,
  startAt,
  target: 'page',
  url: `${BASE}${path}`,
  ...overrides,
});

const ENTRY = createRequest('/assets/index-A.js', 100, 80_000, { endAt: 700 });

const estimate = (requests: RequestValue[]): ReturnType<typeof estimateEntrySharing> => estimateEntrySharing({
  downloadBytesPerSecond: BYTES_PER_SECOND,
  entry: ENTRY,
  latencyMs: LATENCY_MS,
  requests: [ENTRY, ...requests],
});

describe('estimateEntrySharing', () => {
  it('adds up what runs beside the entry script, capped by the entry size, over the channel rate', () => {
    const sharing = estimate([
      createRequest('/assets/mountApp-B.js', 110, 30_000),
      createRequest('/assets/engine-C.js', 120, 110_000),
    ]);

    expect(sharing.bytes).toBe(110_000);
    expect(sharing.delayMs).toBeCloseTo(110);
  });

  it('leaves out the entry itself, style sheets, the document and anything that does not overlap it', () => {
    const sharing = estimate([
      createRequest('/', 0, 2500, { endAt: 120 }),
      createRequest('/assets/index-B.css', 105, 11_000),
      createRequest('/assets/early-D.js', 10, 5000, { endAt: 90 }),
      createRequest('/assets/late-E.js', 710, 5000),
      createRequest('/assets/mountApp-B.js', 110, 20_000),
    ]);

    expect(sharing.bytes).toBe(20_000);
  });

  it('does not count cached answers, revalidations, empty bodies and service worker traffic', () => {
    const sharing = estimate([
      createRequest('/assets/a.js', 110, 0, { fromCache: true }),
      createRequest('/assets/b.js', 110, 300, { isRevalidated: true }),
      createRequest('/assets/c.js', 110, 0),
      createRequest('/assets/d.js', 110, 9000, { target: 'service-worker' }),
      createRequest('/assets/e.js', 110, 4000, { target: 'worker' }),
    ]);

    expect(sharing.bytes).toBe(4000);
  });

  it('counts a request whose first byte can arrive before the entry script ends and leaves out one whose first byte comes after', () => {
    const sharing = estimate([
      createRequest('/assets/started-early-F.js', 599, 30_000, { endAt: 1200 }),
      createRequest('/assets/started-late-G.js', 600, 40_000, { endAt: 1200 }),
      createRequest('/assets/started-later-H.js', 650, 50_000, { endAt: 1200 }),
    ]);

    expect(sharing.bytes).toBe(30_000);
  });

  it('is zero when nothing runs beside the entry script', () => {
    expect(estimate([])).toEqual({ bytes: 0, delayMs: 0 });
  });
});
