import type { PreloadFileValue } from './criticalPreloadTypes.ts';

import {
  formatKiloBytes,
  toKiloBytes,
} from '../build-budget/formatKiloBytes.ts';

export interface PreloadGroupReportValue {
  files: string[];
  gzipKiloBytes: number;
}

export interface PreloadReportInputValue {
  deferredFiles: readonly PreloadFileValue[];
  deferredTriggers: readonly string[];
  inlineScriptBytes: number;
  mainThreadFiles: readonly PreloadFileValue[];
  workerFiles: readonly PreloadFileValue[];
}

export interface PreloadReportValue {
  deferred: PreloadGroupReportValue;
  deferredTriggers: string[];
  inlineScriptBytes: number;
  mainThread: PreloadGroupReportValue;
  worker: PreloadGroupReportValue;
}

const describeGroup = (files: readonly PreloadFileValue[]): PreloadGroupReportValue => ({
  files: files.map(file => `${file.fileName} ${formatKiloBytes(file.gzipBytes)}`),
  gzipKiloBytes: toKiloBytes(files.reduce((total, file) => total + file.gzipBytes, 0)),
});

export const createPreloadReport = ({
  deferredFiles,
  deferredTriggers,
  inlineScriptBytes,
  mainThreadFiles,
  workerFiles,
}: PreloadReportInputValue): PreloadReportValue => ({
  deferred: describeGroup(deferredFiles),
  deferredTriggers: [...deferredTriggers],
  inlineScriptBytes,
  mainThread: describeGroup(mainThreadFiles),
  worker: describeGroup(workerFiles),
});
