import {
  describe,
  expect,
  it,
} from 'vitest';

import { createIdempotencyKey } from './createIdempotencyKey';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('createIdempotencyKey', () => {
  it('returns a UUID', () => {
    expect(createIdempotencyKey()).toMatch(UUID_PATTERN);
  });

  it('returns a new key on every call', () => {
    expect(createIdempotencyKey()).not.toBe(createIdempotencyKey());
  });
});
