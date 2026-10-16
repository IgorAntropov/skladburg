import {
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

import type { PerfReportValue } from './perfTypes.ts';

import {
  formatJsonReport,
  formatMarkdownReport,
} from './formatReport.ts';
import { resolveJsonReportPath } from './reportFilePaths.ts';

export const writeReportFiles = (report: PerfReportValue, markdownPath: string, generatedAt: string): string[] => {
  const jsonPath = resolveJsonReportPath(markdownPath);

  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, `${formatMarkdownReport(report, generatedAt)}\n`);
  writeFileSync(jsonPath, formatJsonReport(report));

  return [markdownPath, jsonPath];
};
