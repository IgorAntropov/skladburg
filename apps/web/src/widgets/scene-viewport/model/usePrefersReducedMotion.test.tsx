import {
  act,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { usePrefersReducedMotion } from './usePrefersReducedMotion';

class FakeQueryList extends EventTarget {
  matches: boolean;

  constructor(matches: boolean) {
    super();
    this.matches = matches;
  }
}

const installMatchMedia = (initialMatches: boolean): FakeQueryList => {
  const queryList = new FakeQueryList(initialMatches);

  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => queryList, writable: true });

  return queryList;
};

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('is false when the browser cannot answer the media query', () => {
    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
  });

  it('reflects the preference and follows its change', () => {
    const queryList = installMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(true);

    act(() => {
      queryList.matches = false;
      queryList.dispatchEvent(new Event('change'));
    });

    expect(result.current).toBe(false);
  });
});
