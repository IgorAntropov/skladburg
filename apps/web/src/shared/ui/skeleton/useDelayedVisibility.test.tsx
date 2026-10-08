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

import {
  SKELETON_DELAY_MS,
  SKELETON_MIN_VISIBLE_MS,
} from './skeletonTiming';
import { useDelayedVisibility } from './useDelayedVisibility';

const STEP_MS = 50;

interface TimelinePointValue {
  isVisible: boolean;
  timeMs: number;
}

const advance = (milliseconds: number): void => {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
};

const recordTimeline = (loadMs: number, totalMs: number): TimelinePointValue[] => {
  const { rerender, result } = renderHook(({ isActive }) => useDelayedVisibility(isActive), {
    initialProps: { isActive: true },
  });
  const timeline: TimelinePointValue[] = [{ isVisible: result.current, timeMs: 0 }];

  for (let timeMs = STEP_MS; timeMs <= totalMs; timeMs += STEP_MS) {
    advance(STEP_MS);
    if (timeMs === loadMs) {
      rerender({ isActive: false });
    }
    timeline.push({ isVisible: result.current, timeMs });
  }

  return timeline;
};

const getVisibleTimes = (timeline: readonly TimelinePointValue[]): number[] => {
  return timeline.filter(point => point.isVisible).map(point => point.timeMs);
};

describe('useDelayedVisibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes the thresholds of the specification', () => {
    expect(SKELETON_DELAY_MS).toBe(250);
    expect(SKELETON_MIN_VISIBLE_MS).toBe(400);
  });

  it('never shows a load that ends in 200 ms', () => {
    const timeline = recordTimeline(200, 1500);

    expect(getVisibleTimes(timeline)).toEqual([]);
  });

  it('shows a load that ends in 300 ms from 250 ms to 650 ms', () => {
    const timeline = recordTimeline(300, 1500);

    expect(getVisibleTimes(timeline)).toEqual([250, 300, 350, 400, 450, 500, 550, 600]);
  });

  it('shows a load that ends in 2 s from 250 ms to 2000 ms', () => {
    const timeline = recordTimeline(2000, 3000);
    const visibleTimes = getVisibleTimes(timeline);

    expect(visibleTimes[0]).toBe(250);
    expect(visibleTimes.at(-1)).toBe(1950);
    expect(visibleTimes).toHaveLength((1950 - 250) / STEP_MS + 1);
  });

  it('turns visible exactly at the delay and not a millisecond earlier', () => {
    const { result } = renderHook(() => useDelayedVisibility(true));

    advance(SKELETON_DELAY_MS - 1);

    expect(result.current).toBe(false);

    advance(1);

    expect(result.current).toBe(true);
  });

  it('hides exactly when the minimum visible time has passed after it appeared', () => {
    const { rerender, result } = renderHook(({ isActive }) => useDelayedVisibility(isActive), {
      initialProps: { isActive: true },
    });

    advance(SKELETON_DELAY_MS);
    rerender({ isActive: false });

    expect(result.current).toBe(true);

    advance(SKELETON_MIN_VISIBLE_MS - 1);

    expect(result.current).toBe(true);

    advance(1);

    expect(result.current).toBe(false);
  });

  it('is hidden at once when the activity ends before the delay', () => {
    const { rerender, result } = renderHook(({ isActive }) => useDelayedVisibility(isActive), {
      initialProps: { isActive: true },
    });

    advance(100);
    rerender({ isActive: false });

    expect(result.current).toBe(false);

    advance(1000);

    expect(result.current).toBe(false);
  });

  it('starts the delay over when the activity restarts', () => {
    const { rerender, result } = renderHook(({ isActive }) => useDelayedVisibility(isActive), {
      initialProps: { isActive: true },
    });

    advance(200);
    rerender({ isActive: false });
    advance(100);
    rerender({ isActive: true });
    advance(200);

    expect(result.current).toBe(false);

    advance(50);

    expect(result.current).toBe(true);
  });

  it('shows the skeleton again for a later load after the first one is over', () => {
    const { rerender, result } = renderHook(({ isActive }) => useDelayedVisibility(isActive), {
      initialProps: { isActive: true },
    });

    advance(SKELETON_DELAY_MS);
    advance(1000);
    rerender({ isActive: false });

    expect(result.current).toBe(false);

    rerender({ isActive: true });

    expect(result.current).toBe(false);

    advance(SKELETON_DELAY_MS);

    expect(result.current).toBe(true);
  });

  it('stays hidden while nothing is active', () => {
    const { result } = renderHook(() => useDelayedVisibility(false));

    advance(5000);

    expect(result.current).toBe(false);
  });

  it('uses the given timing instead of the defaults', () => {
    const { rerender, result } = renderHook(({ isActive }) => useDelayedVisibility(isActive, { delayMs: 10, minVisibleMs: 20 }), {
      initialProps: { isActive: true },
    });

    advance(10);

    expect(result.current).toBe(true);

    rerender({ isActive: false });
    advance(20);

    expect(result.current).toBe(false);
  });
});
