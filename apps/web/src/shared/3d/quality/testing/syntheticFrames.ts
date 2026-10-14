export const SCREEN_60_MS = 1000 / 60;
export const SCREEN_120_MS = 1000 / 120;

export interface SyntheticClockValue {
  now: number;
}

export const feedFrames = (
  clock: SyntheticClockValue,
  push: (timestampMs: number) => void,
  intervalsMs: readonly number[],
): void => {
  for (const intervalMs of intervalsMs) {
    clock.now += intervalMs;
    push(clock.now);
  }
};

export const repeatInterval = (intervalMs: number, count: number): number[] => {
  return Array.from({ length: count }, () => intervalMs);
};
