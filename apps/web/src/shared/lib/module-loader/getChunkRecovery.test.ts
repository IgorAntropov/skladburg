import {
  describe,
  expect,
  it,
} from 'vitest';

import { ChunkLoadError } from './ChunkLoadError';
import { getChunkRecovery } from './getChunkRecovery';

describe('getChunkRecovery', () => {
  it('asks to retry after the first failure of the loader', () => {
    expect(getChunkRecovery(new ChunkLoadError(1))).toBe('retry');
  });

  it('asks to reload the page after the second failure and every one after it', () => {
    expect(getChunkRecovery(new ChunkLoadError(2))).toBe('reload');
    expect(getChunkRecovery(new ChunkLoadError(5))).toBe('reload');
  });

  it('asks to reload the page for an error that is not a chunk error', () => {
    expect(getChunkRecovery(new Error('chunk is unavailable'))).toBe('reload');
    expect(getChunkRecovery('chunk is unavailable')).toBe('reload');
    expect(getChunkRecovery(undefined)).toBe('reload');
  });

  it('treats the inheritors of the chunk error like the chunk error', () => {
    class SectionLikeError extends ChunkLoadError {}

    expect(getChunkRecovery(new SectionLikeError(1))).toBe('retry');
    expect(getChunkRecovery(new SectionLikeError(2))).toBe('reload');
  });
});
