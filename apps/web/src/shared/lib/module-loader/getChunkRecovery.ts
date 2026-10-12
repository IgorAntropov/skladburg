import { ChunkLoadError } from './ChunkLoadError';

export type ChunkRecoveryValue = 'reload' | 'retry';

const FIRST_ATTEMPT = 1;

export const getChunkRecovery = (error: unknown): ChunkRecoveryValue => {
  return error instanceof ChunkLoadError && error.attempt <= FIRST_ATTEMPT ? 'retry' : 'reload';
};
