import {
  act,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the first value at once', () => {
    const { result } = renderHook(() => useDebouncedValue('яб', 150));

    expect(result.current).toBe('яб');
  });

  it('applies a new value only after the delay', () => {
    const { rerender, result } = renderHook(({ value }) => useDebouncedValue(value, 150), {
      initialProps: { value: 'яб' },
    });

    rerender({ value: 'ябл' });
    act(() => {
      vi.advanceTimersByTime(149);
    });

    expect(result.current).toBe('яб');

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe('ябл');
  });

  it('restarts the delay on every change and skips the values in between', () => {
    const { rerender, result } = renderHook(({ value }) => useDebouncedValue(value, 150), {
      initialProps: { value: 'яб' },
    });

    rerender({ value: 'ябл' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'яблок' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('яб');

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe('яблок');
  });

  it('drops the pending value on unmount', () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 150), {
      initialProps: { value: 'яб' },
    });

    rerender({ value: 'ябл' });
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
