import { gzipSync } from 'node:zlib';

import {
  GZIP_LEVEL,
  GZIP_MEMORY_LEVEL,
} from './bundleBudgetConstants.ts';

export const gzipSizeInBytes = (code: string): number =>
  gzipSync(code, { level: GZIP_LEVEL, memLevel: GZIP_MEMORY_LEVEL }).length;
