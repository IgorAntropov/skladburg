import {
  act,
  cleanup,
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

import type { WorldClockReadingValue } from './worldClockTypes';

import { useWorldClockMinute } from './useWorldClockMinute';

const MINUTE_MS = 60_000;
const WORLD_MINUTE_START_MS = Date.UTC(2026, 9, 9, 12, 7, 0);
const WORLD_START_MS = WORLD_MINUTE_START_MS + 20_000;

let visibilityState: DocumentVisibilityState = 'visible';

const createReading = (timeScale: number, worldTimeMs = WORLD_START_MS): WorldClockReadingValue => ({
  receivedAtMs: performance.now(),
  snapshot: { timeScale, worldTimeMs },
});

const changeVisibility = (nextState: DocumentVisibilityState): void => {
  visibilityState = nextState;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const withoutRepeats = (values: readonly (number | undefined)[]): (number | undefined)[] => {
  return values.filter((value, index) => index === 0 || value !== values[index - 1]);
};

const renderMinuteHook = (reading: undefined | WorldClockReadingValue): {
  history: (number | undefined)[];
  rerender: (nextReading: undefined | WorldClockReadingValue) => void;
  unmount: () => void;
} => {
  const history: (number | undefined)[] = [];
  const { rerender, unmount } = renderHook(
    ({ current }: { current: undefined | WorldClockReadingValue }) => {
      const minuteMs = useWorldClockMinute(current);
      history.push(minuteMs);

      return minuteMs;
    },
    { initialProps: { current: reading } },
  );

  const rerenderWith = (nextReading: undefined | WorldClockReadingValue): void => {
    rerender({ current: nextReading });
  };

  return { history, rerender: rerenderWith, unmount };
};

describe('useWorldClockMinute', () => {
  beforeEach(() => {
    visibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('has no minute and no timer without a reading', () => {
    const { history } = renderMinuteHook(undefined);

    expect(withoutRepeats(history)).toEqual([undefined]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts at the minute of the world right after the first render', () => {
    const { history } = renderMinuteHook(createReading(1));

    expect(withoutRepeats(history)).toEqual([undefined, WORLD_MINUTE_START_MS]);
  });

  it('changes the minute exactly once, right when the world minute changes, at the scale 1', () => {
    const { history } = renderMinuteHook(createReading(1));

    advance(39_999);
    expect(withoutRepeats(history)).toEqual([undefined, WORLD_MINUTE_START_MS]);

    advance(1);
    expect(withoutRepeats(history)).toEqual([undefined, WORLD_MINUTE_START_MS, WORLD_MINUTE_START_MS + MINUTE_MS]);

    advance(MINUTE_MS - 1);
    expect(withoutRepeats(history)).toHaveLength(3);
  });

  it('changes the minute once a second at the scale 60', () => {
    const { history } = renderMinuteHook(createReading(60, WORLD_MINUTE_START_MS));

    advance(1000);
    advance(1000);
    advance(1000);

    expect(withoutRepeats(history)).toEqual([
      undefined,
      WORLD_MINUTE_START_MS,
      WORLD_MINUTE_START_MS + MINUTE_MS,
      WORLD_MINUTE_START_MS + 2 * MINUTE_MS,
      WORLD_MINUTE_START_MS + 3 * MINUTE_MS,
    ]);
  });

  it('keeps one timer at a time while it ticks', () => {
    renderMinuteHook(createReading(60, WORLD_MINUTE_START_MS));

    advance(5000);

    expect(vi.getTimerCount()).toBe(1);
  });

  it('sets no timer and keeps the minute at the scale 0', () => {
    const { history } = renderMinuteHook(createReading(0));

    expect(vi.getTimerCount()).toBe(0);

    advance(10 * MINUTE_MS);

    expect(withoutRepeats(history)).toEqual([undefined, WORLD_MINUTE_START_MS]);
  });

  it('sets no timer when the tab is hidden from the start', () => {
    visibilityState = 'hidden';

    const { history } = renderMinuteHook(createReading(1));

    expect(vi.getTimerCount()).toBe(0);
    expect(withoutRepeats(history)).toEqual([undefined, WORLD_MINUTE_START_MS]);
  });

  it('drops the timer when the tab gets hidden', () => {
    renderMinuteHook(createReading(1));
    expect(vi.getTimerCount()).toBe(1);

    changeVisibility('hidden');

    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the minute still while the tab is hidden', () => {
    const { history } = renderMinuteHook(createReading(1));

    changeVisibility('hidden');
    advance(10 * MINUTE_MS);

    expect(withoutRepeats(history)).toEqual([undefined, WORLD_MINUTE_START_MS]);
  });

  it('shows the right minute at once and restarts the timer when the tab gets visible again', () => {
    const { history } = renderMinuteHook(createReading(1));

    changeVisibility('hidden');
    advance(10 * MINUTE_MS);
    changeVisibility('visible');

    expect(history.at(-1)).toBe(WORLD_MINUTE_START_MS + 10 * MINUTE_MS);
    expect(vi.getTimerCount()).toBe(1);

    advance(40_000);

    expect(history.at(-1)).toBe(WORLD_MINUTE_START_MS + 11 * MINUTE_MS);
  });

  it('does not change anything when the tab gets visible and the minute is the same', () => {
    const { history } = renderMinuteHook(createReading(1));

    changeVisibility('hidden');
    changeVisibility('visible');

    expect(withoutRepeats(history)).toEqual([undefined, WORLD_MINUTE_START_MS]);
  });

  it('takes a new reading at once and keeps one timer', () => {
    const { history, rerender } = renderMinuteHook(createReading(1));
    const nextWorldMinuteStartMs = WORLD_MINUTE_START_MS + 30 * MINUTE_MS;

    rerender(createReading(1, nextWorldMinuteStartMs));

    expect(history.at(-1)).toBe(nextWorldMinuteStartMs);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('stops the timer when the reading is gone', () => {
    const { history, rerender } = renderMinuteHook(createReading(1));

    rerender(undefined);

    expect(history.at(-1)).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('removes the timer and the listener on unmount', () => {
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderMinuteHook(createReading(1));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
