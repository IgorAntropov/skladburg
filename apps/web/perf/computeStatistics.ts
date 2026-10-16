import type {
  MetricNameValue,
  MetricSummaryValue,
  RunValue,
  SeriesSummaryValue,
} from './perfTypes.ts';

export const METRIC_NAMES: readonly MetricNameValue[] = [
  'ttfb',
  'fcp',
  'skeletonShown',
  'entryStart',
  'skeletonFromEntry',
  'lcp',
  'workerCreated',
  'engineReady',
  'firstScreenReady',
  'firstScreenFromEntry',
  'entrySharingBytes',
  'entrySharingMs',
  'sceneFirstFrame',
  'longTaskCount',
  'longTaskExcessMs',
  'bytesBeforeReady',
  'requestsBeforeReady',
  'serviceWorkerBytesBeforeReady',
  'serviceWorkerRequestsBeforeReady',
];

export const computeMedian = (values: readonly number[]): null | number => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted[middle - 1];

  if (upper === undefined) {
    return null;
  }

  return sorted.length % 2 === 1 || lower === undefined ? upper : (lower + upper) / 2;
};

export const summarizeMetric = (values: readonly (null | number)[]): MetricSummaryValue => {
  const present = values.filter((value): value is number => value !== null);

  if (present.length === 0) {
    return { max: null, median: null, min: null, sampleCount: 0 };
  }

  return {
    max: Math.max(...present),
    median: computeMedian(present),
    min: Math.min(...present),
    sampleCount: present.length,
  };
};

export const summarizeSeries = (runs: readonly RunValue[]): SeriesSummaryValue => {
  const entries = METRIC_NAMES.map(name => [name, summarizeMetric(runs.map(run => run[name] ?? null))] as const);

  return Object.fromEntries(entries) as SeriesSummaryValue;
};

export const findMedianRun = (runs: readonly RunValue[]): RunValue | undefined => {
  const ready = runs
    .filter((run): run is RunValue & { firstScreenReady: number } => run.firstScreenReady !== null)
    .sort((first, second) => first.firstScreenReady - second.firstScreenReady);

  return ready[Math.floor((ready.length - 1) / 2)];
};

export const computeSpreadRatio = (summary: MetricSummaryValue): null | number => {
  if (summary.median === null || summary.median === 0 || summary.min === null || summary.max === null) {
    return null;
  }

  return (summary.max - summary.min) / summary.median;
};
