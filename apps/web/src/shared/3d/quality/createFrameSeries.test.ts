import {
  describe,
  expect,
  it,
} from 'vitest';

import type { FrameWindowValue } from './createFrameSeries';

import { createFrameSeries } from './createFrameSeries';
import {
  feedFrames,
  repeatInterval,
  SCREEN_60_MS,
  SCREEN_120_MS,
} from './testing/syntheticFrames';

const IDLE_GAP_MS = 100;
const WINDOW_SIZE = 30;
const FRAMES_FOR_ONE_WINDOW = WINDOW_SIZE + 2;

const createHarness = (): {
  clock: { now: number };
  push: (intervalsMs: readonly number[]) => FrameWindowValue[];
  reset: () => void;
} => {
  const series = createFrameSeries({ idleGapMs: IDLE_GAP_MS, windowSize: WINDOW_SIZE });
  const clock = { now: 1000 };

  return {
    clock,
    push: (intervalsMs) => {
      const windows: FrameWindowValue[] = [];

      feedFrames(clock, (timestampMs) => {
        const window = series.push(timestampMs);

        if (window !== undefined) {
          windows.push({ ...window });
        }
      }, intervalsMs);

      return windows;
    },
    reset: series.reset,
  };
};

describe('createFrameSeries', () => {
  it('gives no window until the first frame, the skipped interval and thirty intervals are in', () => {
    const { push } = createHarness();

    expect(push(repeatInterval(SCREEN_60_MS, FRAMES_FOR_ONE_WINDOW - 1))).toEqual([]);
    expect(push([SCREEN_60_MS])).toHaveLength(1);
  });

  it('does not count the first interval of a series', () => {
    const { push } = createHarness();

    const [window] = push([90, ...repeatInterval(SCREEN_60_MS, WINDOW_SIZE), SCREEN_60_MS]);

    expect(window?.medianMs).toBeCloseTo(SCREEN_60_MS, 5);
    expect(window?.p90Ms).toBeCloseTo(SCREEN_60_MS, 5);
  });

  it('reports median, ninetieth percentile and screen interval of a stable 60 Hz window', () => {
    const { push } = createHarness();

    const [window] = push(repeatInterval(SCREEN_60_MS, FRAMES_FOR_ONE_WINDOW));

    expect(window?.medianMs).toBeCloseTo(SCREEN_60_MS, 5);
    expect(window?.p90Ms).toBeCloseTo(SCREEN_60_MS, 5);
    expect(window?.screenIntervalMs).toBeCloseTo(SCREEN_60_MS, 5);
    expect(window?.durationMs).toBeCloseTo(SCREEN_60_MS * WINDOW_SIZE, 3);
  });

  it('estimates the screen interval of a 120 Hz screen from the lower intervals', () => {
    const { push } = createHarness();

    const [window] = push(repeatInterval(SCREEN_120_MS, FRAMES_FOR_ONE_WINDOW));

    expect(window?.screenIntervalMs).toBeCloseTo(SCREEN_120_MS, 5);
  });

  it('keeps the 120 Hz screen interval in a mix of 8.3 and 16.7 ms frames', () => {
    const { push } = createHarness();
    const mix = Array.from({ length: FRAMES_FOR_ONE_WINDOW }, (_, index) => {
      return index % 4 === 0 ? SCREEN_60_MS : SCREEN_120_MS;
    });

    const [window] = push(mix);

    expect(window?.screenIntervalMs).toBeCloseTo(SCREEN_120_MS, 5);
    expect(window?.medianMs).toBeLessThan(SCREEN_60_MS);
    expect(window?.p90Ms).toBeCloseTo(SCREEN_60_MS, 5);
  });

  it('reports a steady 33 ms window as slow', () => {
    const { push } = createHarness();

    const [window] = push(repeatInterval(33.3, FRAMES_FOR_ONE_WINDOW));

    expect(window?.medianMs).toBeCloseTo(33.3, 5);
  });

  it('closes the series on a pause longer than the idle gap and starts counting anew', () => {
    const { push } = createHarness();

    expect(push(repeatInterval(SCREEN_60_MS, 20))).toEqual([]);
    expect(push([IDLE_GAP_MS + 1])).toEqual([]);
    expect(push(repeatInterval(SCREEN_60_MS, FRAMES_FOR_ONE_WINDOW - 2))).toEqual([]);
    expect(push([SCREEN_60_MS])).toHaveLength(1);
  });

  it('keeps a pause between gestures out of the windows', () => {
    const { push } = createHarness();

    const firstGesture = push(repeatInterval(SCREEN_60_MS, FRAMES_FOR_ONE_WINDOW));
    const secondGesture = push([2000, ...repeatInterval(SCREEN_60_MS, FRAMES_FOR_ONE_WINDOW)]);

    expect([...firstGesture, ...secondGesture]).toHaveLength(2);

    for (const window of [...firstGesture, ...secondGesture]) {
      expect(window.medianMs).toBeCloseTo(SCREEN_60_MS, 5);
      expect(window.p90Ms).toBeCloseTo(SCREEN_60_MS, 5);
    }
  });

  it('keeps the median at the frame time when a slow drag leaves short holes under the idle gap', () => {
    const { push } = createHarness();
    const draggedWithHoles = Array.from({ length: FRAMES_FOR_ONE_WINDOW }, (_, index) => {
      return index % 4 === 3 ? 80 : SCREEN_60_MS;
    });

    const [window] = push(draggedWithHoles);

    expect(window?.medianMs).toBeCloseTo(SCREEN_60_MS, 5);
  });

  it('ignores a repeated timestamp of the same frame', () => {
    const series = createFrameSeries({ idleGapMs: IDLE_GAP_MS, windowSize: 3 });

    series.push(1000);
    series.push(1000);
    series.push(1016);
    series.push(1032);
    series.push(1048);

    expect(series.push(1048)).toBeUndefined();
    expect(series.push(1048)).toBeUndefined();
    expect(series.push(1064)).toBeDefined();
  });

  it('keeps the previous window intact when the next one is produced', () => {
    const series = createFrameSeries({ idleGapMs: IDLE_GAP_MS, windowSize: WINDOW_SIZE });
    const clock = { now: 1000 };
    const produced: FrameWindowValue[] = [];

    feedFrames(clock, (timestampMs) => {
      const window = series.push(timestampMs);

      if (window !== undefined) {
        produced.push(window);
      }
    }, [...repeatInterval(SCREEN_60_MS, FRAMES_FOR_ONE_WINDOW), ...repeatInterval(33.3, WINDOW_SIZE)]);

    const [previous, latest] = produced;

    expect(previous?.medianMs).toBeCloseTo(SCREEN_60_MS, 5);
    expect(latest?.medianMs).toBeCloseTo(33.3, 5);
  });

  it('forgets the partial series on reset', () => {
    const { push, reset } = createHarness();

    push(repeatInterval(SCREEN_60_MS, 20));
    reset();

    expect(push(repeatInterval(SCREEN_60_MS, FRAMES_FOR_ONE_WINDOW - 1))).toEqual([]);
  });
});
