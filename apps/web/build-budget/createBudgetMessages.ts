import type { InitialBundleValue } from './bundleBudgetTypes.ts';

import {
  formatKiloBytes,
  toKiloBytes,
} from './formatKiloBytes.ts';

export interface BudgetReportValue {
  chunks: string[];
  entry: string;
  headroomKiloBytes: number;
  initialGzipKiloBytes: number;
  limitKiloBytes: number;
}

const describeChunks = (bundle: InitialBundleValue): string[] =>
  bundle.chunks.map(chunk => `${chunk.fileName} ${formatKiloBytes(chunk.gzipBytes)}`);

export const createBudgetReport = (bundle: InitialBundleValue, limitBytes: number): BudgetReportValue => ({
  chunks: describeChunks(bundle),
  entry: bundle.entryFileName,
  headroomKiloBytes: toKiloBytes(limitBytes - bundle.gzipBytes),
  initialGzipKiloBytes: toKiloBytes(bundle.gzipBytes),
  limitKiloBytes: toKiloBytes(limitBytes),
});

export const createBudgetViolationMessage = (bundle: InitialBundleValue, limitBytes: number): string => {
  const overshoot = formatKiloBytes(bundle.gzipBytes - limitBytes);

  return [
    `Initial JS of entry "${bundle.entryFileName}" is ${formatKiloBytes(bundle.gzipBytes)} gzip,`,
    `which exceeds the budget of ${formatKiloBytes(limitBytes)} by ${overshoot}.`,
    `Chunks loaded at startup: ${describeChunks(bundle).join(', ')}.`,
  ].join(' ');
};
