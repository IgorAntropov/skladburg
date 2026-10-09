import {
  describe,
  expect,
  it,
} from 'vitest';

import { worldClockKeys } from './worldClockKeys';

describe('worldClockKeys', () => {
  it('builds the current key without any organization or user', () => {
    expect(worldClockKeys.all).toEqual(['world-clock']);
    expect(worldClockKeys.current()).toEqual(['world-clock', 'current']);
  });

  it('starts the current key with the root key', () => {
    expect(worldClockKeys.current().slice(0, worldClockKeys.all.length)).toEqual(worldClockKeys.all);
  });
});
