import {
  describe,
  expect,
  it,
} from 'vitest';

import { gzipSizeInBytes } from './gzipSizeInBytes.ts';

describe('gzipSizeInBytes', () => {
  it('compresses repetitive code well below its length', () => {
    const code = 'export const value = 1;\n'.repeat(500);

    expect(gzipSizeInBytes(code)).toBeLessThan(code.length / 10);
  });

  it('is deterministic', () => {
    const code = 'export const value = 1;\n'.repeat(50);

    expect(gzipSizeInBytes(code)).toBe(gzipSizeInBytes(code));
  });

  it('counts the gzip header for an empty input', () => {
    expect(gzipSizeInBytes('')).toBeGreaterThan(0);
  });
});
