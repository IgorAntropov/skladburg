import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createRandomUuid,
  formatUuidV4,
} from './randomUuid';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('formatUuidV4', () => {
  it('formats fixed zero bytes with the version 4 and the 10xx variant', () => {
    expect(formatUuidV4(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('forces the version and the variant over the bits of all ones', () => {
    expect(formatUuidV4(new Uint8Array(16).fill(0xff))).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('keeps the other bytes in order', () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, index) => index + 1);

    expect(formatUuidV4(bytes)).toBe('01020304-0506-4708-890a-0b0c0d0e0f10');
  });

  it('does not change the source bytes', () => {
    const bytes = new Uint8Array(16).fill(0xff);

    formatUuidV4(bytes);

    expect(bytes.every(byte => byte === 0xff)).toBe(true);
  });
});

describe('createRandomUuid', () => {
  it('takes sixteen bytes from the injected source', () => {
    const requestedLengths: number[] = [];

    const uuid = createRandomUuid((bytes) => {
      requestedLengths.push(bytes.length);
      bytes.fill(0xab);

      return bytes;
    });

    expect(requestedLengths).toEqual([16]);
    expect(uuid).toBe('abababab-abab-4bab-abab-abababababab');
  });

  it('produces a valid UUID v4 from the platform source', () => {
    const uuid = createRandomUuid(bytes => crypto.getRandomValues(bytes));

    expect(uuid).toMatch(UUID_V4_PATTERN);
  });
});
