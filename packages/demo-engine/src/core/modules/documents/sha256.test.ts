import { createHash } from 'node:crypto';
import {
  describe,
  expect,
  it,
} from 'vitest';

import * as hashes from './sha256';

describe('sha256', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['a'.repeat(1_000_000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
  ])('matches the standard vector for %s', (input, expected) => {
    expect(hashes.sha256(new TextEncoder().encode(input))).toBe(expected);
  });

  it.each([55, 56, 63, 64, 65, 119, 120])('matches the digest of binary content at length %i', (length) => {
    const bytes = Uint8Array.from({ length }, (_, index) => 255 - index);
    expect(hashes.sha256(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
  });
});
