import {
  getMsIntoWorldMinute,
  WORLD_MINUTE_MS,
} from './worldMinute';

export const MIN_TICK_DELAY_MS = 1000;

export const nextTickDelayMs = (worldTimeMs: number, timeScale: number): number | undefined => {
  if (!Number.isFinite(timeScale) || timeScale <= 0) {
    return undefined;
  }

  const worldMsToNextMinute = WORLD_MINUTE_MS - getMsIntoWorldMinute(worldTimeMs);

  return Math.max(MIN_TICK_DELAY_MS, Math.ceil(worldMsToNextMinute / timeScale));
};
