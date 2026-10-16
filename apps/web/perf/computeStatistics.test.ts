import {
  describe,
  expect,
  it,
} from 'vitest';

import type { RunValue } from './perfTypes.ts';

import {
  computeMedian,
  computeSpreadRatio,
  findMedianRun,
  summarizeMetric,
  summarizeSeries,
} from './computeStatistics.ts';

const createRun = (overrides: Partial<RunValue> = {}): RunValue => ({
  bytesBeforeReady: 0,
  duplicates: [],
  engineReady: null,
  fcp: null,
  firstScreenReady: null,
  isServiceWorkerThrottled: null,
  isWorkerThrottled: false,
  lcp: null,
  longTaskCount: 0,
  longTaskExcessMs: 0,
  requests: [],
  requestsBeforeReady: 0,
  sceneFirstFrame: null,
  serviceWorkerBytesBeforeReady: 0,
  serviceWorkerRepeats: [],
  serviceWorkerRequestsBeforeReady: 0,
  skeletonShown: null,
  ttfb: null,
  workerCreated: null,
  workerMessages: [],
  ...overrides,
});

describe('computeMedian', () => {
  it('takes the middle of an odd count regardless of order', () => {
    expect(computeMedian([30, 10, 20])).toBe(20);
  });

  it('averages the two middle values of an even count', () => {
    expect(computeMedian([40, 10, 20, 30])).toBe(25);
  });

  it('returns null for no values', () => {
    expect(computeMedian([])).toBeNull();
  });

  it('does not reorder its input', () => {
    const values = [3, 1, 2];

    computeMedian(values);

    expect(values).toEqual([3, 1, 2]);
  });
});

describe('summarizeMetric', () => {
  it('ignores missing values but counts the present ones', () => {
    expect(summarizeMetric([100, null, 300, 200])).toEqual({ max: 300, median: 200, min: 100, sampleCount: 3 });
  });

  it('reports nothing when every value is missing', () => {
    expect(summarizeMetric([null, null])).toEqual({ max: null, median: null, min: null, sampleCount: 0 });
  });
});

describe('summarizeSeries', () => {
  it('summarizes every metric by name', () => {
    const summary = summarizeSeries([
      createRun({ firstScreenReady: 1500, longTaskCount: 2 }),
      createRun({ firstScreenReady: 2500, longTaskCount: 4 }),
      createRun({ firstScreenReady: 2000, longTaskCount: 3 }),
    ]);

    expect(summary.firstScreenReady).toEqual({ max: 2500, median: 2000, min: 1500, sampleCount: 3 });
    expect(summary.longTaskCount.median).toBe(3);
    expect(summary.sceneFirstFrame.sampleCount).toBe(0);
  });
});

describe('findMedianRun', () => {
  it('picks the run with the median first screen time', () => {
    const median = createRun({ firstScreenReady: 2000 });

    expect(findMedianRun([createRun({ firstScreenReady: 3000 }), median, createRun({ firstScreenReady: 1000 })])).toBe(median);
  });

  it('takes the lower of two middle runs for an even count', () => {
    const lower = createRun({ firstScreenReady: 1000 });

    expect(findMedianRun([createRun({ firstScreenReady: 2000 }), lower])).toBe(lower);
  });

  it('skips runs that never reached the first screen', () => {
    expect(findMedianRun([createRun(), createRun()])).toBeUndefined();
  });
});

describe('computeSpreadRatio', () => {
  it('relates the range to the median', () => {
    expect(computeSpreadRatio({ max: 2300, median: 2000, min: 1700, sampleCount: 5 })).toBeCloseTo(0.3);
  });

  it('is undefined for an empty or zero-median series', () => {
    expect(computeSpreadRatio({ max: null, median: null, min: null, sampleCount: 0 })).toBeNull();
    expect(computeSpreadRatio({ max: 5, median: 0, min: 0, sampleCount: 2 })).toBeNull();
  });
});
