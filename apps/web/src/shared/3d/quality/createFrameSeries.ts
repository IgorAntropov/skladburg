export interface FrameWindowValue {
  durationMs: number;
  medianMs: number;
  p90Ms: number;
  screenIntervalMs: number;
}

export interface IFrameSeries {
  push: (timestampMs: number) => FrameWindowValue | undefined;
  reset: () => void;
}

interface FrameSeriesOptionsValue {
  idleGapMs: number;
  windowSize: number;
}

const SKIPPED_INTERVAL_COUNT = 1;
const HALF = 0.5;
const P90_FRACTION = 0.9;
const SCREEN_INTERVAL_FRACTION = 0.25;

const sumOf = (values: Float64Array): number => {
  let sum = 0;

  for (const value of values) {
    sum += value;
  }

  return sum;
};

const readSorted = (sorted: Float64Array, index: number): number => sorted[index] ?? 0;

const createEmptyWindow = (): FrameWindowValue => ({
  durationMs: 0,
  medianMs: 0,
  p90Ms: 0,
  screenIntervalMs: 0,
});

const summarizeWindow = (intervals: Float64Array, sorted: Float64Array, target: FrameWindowValue): FrameWindowValue => {
  const { length } = intervals;
  const middle = Math.floor(length * HALF);

  sorted.set(intervals);
  sorted.sort();

  const medianMs = length % 2 === 0
    ? (readSorted(sorted, middle - 1) + readSorted(sorted, middle)) * HALF
    : readSorted(sorted, middle);

  target.durationMs = sumOf(intervals);
  target.medianMs = medianMs;
  target.p90Ms = readSorted(sorted, Math.ceil(length * P90_FRACTION) - 1);
  target.screenIntervalMs = readSorted(sorted, Math.floor((length - 1) * SCREEN_INTERVAL_FRACTION));

  return target;
};

export const createFrameSeries = ({ idleGapMs, windowSize }: FrameSeriesOptionsValue): IFrameSeries => {
  const intervals = new Float64Array(windowSize);
  const sorted = new Float64Array(windowSize);
  const firstWindow = createEmptyWindow();
  const secondWindow = createEmptyWindow();

  let isFirstWindowNext = true;
  let previousTimestampMs: number | undefined;
  let skippedIntervalsLeft = SKIPPED_INTERVAL_COUNT;
  let filledCount = 0;

  const reset = (): void => {
    previousTimestampMs = undefined;
    skippedIntervalsLeft = SKIPPED_INTERVAL_COUNT;
    filledCount = 0;
  };

  const push = (timestampMs: number): FrameWindowValue | undefined => {
    if (previousTimestampMs === undefined) {
      previousTimestampMs = timestampMs;

      return undefined;
    }

    const intervalMs = timestampMs - previousTimestampMs;

    if (intervalMs <= 0) {
      return undefined;
    }

    previousTimestampMs = timestampMs;

    if (intervalMs > idleGapMs) {
      skippedIntervalsLeft = SKIPPED_INTERVAL_COUNT;
      filledCount = 0;

      return undefined;
    }

    if (skippedIntervalsLeft > 0) {
      skippedIntervalsLeft -= 1;

      return undefined;
    }

    intervals[filledCount] = intervalMs;
    filledCount += 1;

    if (filledCount < windowSize) {
      return undefined;
    }

    filledCount = 0;

    const target = isFirstWindowNext ? firstWindow : secondWindow;

    isFirstWindowNext = !isFirstWindowNext;

    return summarizeWindow(intervals, sorted, target);
  };

  return { push, reset };
};
