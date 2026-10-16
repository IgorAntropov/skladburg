import type { PreloadFileValue } from './criticalPreloadTypes.ts';

import {
  formatKiloBytes,
  toKiloBytes,
} from '../build-budget/formatKiloBytes.ts';

export interface PreloadGroupReportValue {
  files: string[];
  gzipKiloBytes: number;
}

export interface PreloadReportValue {
  mainThread: PreloadGroupReportValue;
  worker: PreloadGroupReportValue;
}

const describeGroup = (files: readonly PreloadFileValue[]): PreloadGroupReportValue => ({
  files: files.map(file => `${file.fileName} ${formatKiloBytes(file.gzipBytes)}`),
  gzipKiloBytes: toKiloBytes(files.reduce((total, file) => total + file.gzipBytes, 0)),
});

export const createPreloadReport = (
  mainThreadFiles: readonly PreloadFileValue[],
  workerFiles: readonly PreloadFileValue[],
): PreloadReportValue => ({
  mainThread: describeGroup(mainThreadFiles),
  worker: describeGroup(workerFiles),
});
