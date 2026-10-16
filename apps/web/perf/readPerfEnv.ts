import type { PerfPreviewProtocolValue } from './perfPreview.ts';

import { readPreviewProtocol } from './perfPreview.ts';

export type PerfEnvSourceValue = Readonly<Record<string, string | undefined>>;

export interface PerfEnvValue {
  baseUrl: string | undefined;
  coldRunCount: number;
  pagesSkeletonBaselineMs: number | undefined;
  previewProtocol: PerfPreviewProtocolValue;
  profileNames: string[] | undefined;
  reportFile: string | undefined;
  warmRunCount: number;
}

export const DEFAULT_COLD_RUN_COUNT = 7;
export const MAX_WARM_RUN_COUNT = 5;

const readNonBlank = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
};

const readRunCount = (value: string | undefined): number => {
  const text = readNonBlank(value);

  if (text === undefined) {
    return DEFAULT_COLD_RUN_COUNT;
  }

  const count = Number(text);

  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`PERF_RUNS must be a positive integer, got "${text}"`);
  }

  return count;
};

const readBaselineMs = (value: string | undefined): number | undefined => {
  const text = readNonBlank(value);

  if (text === undefined) {
    return undefined;
  }

  const baselineMs = Number(text);

  if (!Number.isFinite(baselineMs) || baselineMs <= 0) {
    throw new Error(`PERF_PAGES_SKELETON_BASELINE_MS must be a positive number of milliseconds, got "${text}"`);
  }

  return baselineMs;
};

const readProfileNames = (value: string | undefined): string[] | undefined => {
  const text = readNonBlank(value);

  if (text === undefined) {
    return undefined;
  }

  return text.split(',').map(name => name.trim()).filter(name => name !== '');
};

export const withTrailingSlash = (address: string): string => (address.endsWith('/') ? address : `${address}/`);

export const readPerfEnv = (env: PerfEnvSourceValue): PerfEnvValue => {
  const coldRunCount = readRunCount(env.PERF_RUNS);
  const baseUrl = readNonBlank(env.PERF_BASE_URL);

  return {
    baseUrl: baseUrl === undefined ? undefined : withTrailingSlash(baseUrl),
    coldRunCount,
    pagesSkeletonBaselineMs: readBaselineMs(env.PERF_PAGES_SKELETON_BASELINE_MS),
    previewProtocol: readPreviewProtocol(env),
    profileNames: readProfileNames(env.PERF_PROFILES),
    reportFile: readNonBlank(env.PERF_REPORT_FILE),
    warmRunCount: Math.min(MAX_WARM_RUN_COUNT, coldRunCount),
  };
};
