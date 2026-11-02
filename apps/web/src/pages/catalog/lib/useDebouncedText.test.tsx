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

import { useDebouncedText } from './useDebouncedText';

const DELAY_MS = 300;

describe('useDebouncedText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies the text after the pause from the first character', () => {
    const { result } = renderHook(() => useDebouncedText(DELAY_MS));

    act(() => {
      result.current.setText('я');
    });
    act(() => {
      vi.advanceTimersByTime(DELAY_MS - 1);
    });

    expect(result.current.appliedText).toBe('');

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.appliedText).toBe('я');
  });

  it('restarts the pause on every character and applies only the last text', () => {
    const { result } = renderHook(() => useDebouncedText(DELAY_MS));

    act(() => {
      result.current.setText('я');
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.setText('яблоки');
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.appliedText).toBe('');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.appliedText).toBe('яблоки');
  });

  it('clears the applied text at once and drops the pending one on reset', () => {
    const { result } = renderHook(() => useDebouncedText(DELAY_MS));

    act(() => {
      result.current.setText('яблоки');
    });
    act(() => {
      vi.advanceTimersByTime(DELAY_MS);
    });
    act(() => {
      result.current.setText('груши');
    });
    act(() => {
      result.current.reset();
    });
    act(() => {
      vi.advanceTimersByTime(DELAY_MS * 2);
    });

    expect(result.current.appliedText).toBe('');
  });

  it('drops the pending text when the component goes away', () => {
    const { result, unmount } = renderHook(() => useDebouncedText(DELAY_MS));

    act(() => {
      result.current.setText('яблоки');
    });
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
