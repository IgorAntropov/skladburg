import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { FakeMediaQueryList } from '@/shared/theme/index.testing';

import { readColorSchemeQuery } from './readColorSchemeQuery';

describe('readColorSchemeQuery', () => {
  it('asks the device about the dark color scheme', () => {
    const query = new FakeMediaQueryList(true);
    const matchMedia = vi.fn(() => query);

    expect(readColorSchemeQuery({ matchMedia })).toBe(query);
    expect(matchMedia).toHaveBeenCalledExactlyOnceWith('(prefers-color-scheme: dark)');
  });

  it('returns nothing when the environment has no media queries', () => {
    expect(readColorSchemeQuery({})).toBeUndefined();
  });
});
