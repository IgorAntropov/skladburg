import {
  describe,
  expect,
  it,
} from 'vitest';

import { removeSearchParam } from './removeSearchParam';

const createSnapshot = (path: string, query: string): { path: string; searchParams: URLSearchParams } => ({
  path,
  searchParams: new URLSearchParams(query),
});

describe('removeSearchParam', () => {
  it('returns the bare path when the removed parameter was the only one', () => {
    expect(removeSearchParam(createSnapshot('/deals', 'as=abc'), 'as')).toBe('/deals');
  });

  it('keeps the other parameters in their order', () => {
    expect(removeSearchParam(createSnapshot('/deals', 'tab=open&as=abc&sort=date'), 'as')).toBe('/deals?tab=open&sort=date');
  });

  it('removes every occurrence of the parameter', () => {
    expect(removeSearchParam(createSnapshot('/deals', 'as=a&as=b&tab=open'), 'as')).toBe('/deals?tab=open');
  });

  it('leaves the path alone when the parameter is absent', () => {
    expect(removeSearchParam(createSnapshot('/deals', 'tab=open'), 'as')).toBe('/deals?tab=open');
  });

  it('keeps the object path', () => {
    expect(removeSearchParam(createSnapshot('/deals/f6000001-0000-4000-8000-000000000000', 'as=abc'), 'as'))
      .toBe('/deals/f6000001-0000-4000-8000-000000000000');
  });
});
