import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  formatKiloBytes,
  toKiloBytes,
} from './formatKiloBytes.ts';

describe('formatKiloBytes', () => {
  it('counts a kilobyte as 1000 bytes', () => {
    expect(formatKiloBytes(442_674)).toBe('442.67 kB');
    expect(toKiloBytes(442_674)).toBe(442.67);
  });

  it('keeps two decimals', () => {
    expect(formatKiloBytes(1_000)).toBe('1.00 kB');
    expect(formatKiloBytes(0)).toBe('0.00 kB');
  });
});
