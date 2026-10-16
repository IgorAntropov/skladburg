import type {
  CriticalPreloadBundleValue,
  PreloadChunkValue,
} from './criticalPreloadTypes.ts';

import { gzipSizeInBytes } from '../build-budget/gzipSizeInBytes.ts';

export interface BundleChunksValue {
  chunks: PreloadChunkValue[];
  gzipBytesByFileName: Map<string, number>;
}

export const readBundleChunks = (bundle: CriticalPreloadBundleValue): BundleChunksValue => {
  const chunks: PreloadChunkValue[] = [];
  const gzipBytesByFileName = new Map<string, number>();

  for (const output of Object.values(bundle)) {
    if (output.type === 'chunk') {
      chunks.push(output);
      gzipBytesByFileName.set(output.fileName, gzipSizeInBytes(output.code));
    }
  }

  return { chunks, gzipBytesByFileName };
};
