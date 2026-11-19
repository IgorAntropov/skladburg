import {
  expect,
  it,
} from 'vitest';

import {
  isYardClockRefreshDue,
  readYardClockDelay,
} from './yardDispatchClock';

it('chooses an exact slot boundary in preference to a world-minute tick', () => {
  expect(readYardClockDelay(120_001, 1, [120_000, 123_420, 240_000], [])).toBe(3_419);
  expect(readYardClockDelay(120_001, 60, [120_000, 123_420, 240_000], [])).toBe(57);
});

it('does not keep a timer on a paused world and limits high-speed display updates', () => {
  expect(readYardClockDelay(120_000, 0, [121_000], [121_000])).toBeUndefined();
  expect(readYardClockDelay(179_999, 60, [], [])).toBe(1_000);
});

it('updates the countdown at a minute relative to a slot that starts between world minutes', () => {
  expect(readYardClockDelay(280_000, 1, [342_000], [342_000])).toBe(2_000);
});

it('refreshes time-driven priorities at most every 15 real seconds', () => {
  expect(isYardClockRefreshDue(60_000, 119_999, 20_000, 35_000)).toBe(false);
  expect(isYardClockRefreshDue(60_000, 120_000, 20_000, 34_999)).toBe(false);
  expect(isYardClockRefreshDue(60_000, 120_000, 20_000, 35_000)).toBe(true);
});
