const WORLD_MINUTE_MS = 60_000;
const MIN_DISPLAY_DELAY_MS = 1_000;
const MIN_REFRESH_DELAY_MS = 15_000;

const readWorldMinute = (timeMs: number): number => Math.floor(timeMs / WORLD_MINUTE_MS);

export const readYardClockDelay = (
  worldTimeMs: number,
  timeScale: number,
  boundaries: readonly number[],
  slotStarts: readonly number[],
): number | undefined => {
  if (!Number.isFinite(timeScale) || timeScale <= 0) {
    return undefined;
  }

  const nextMinute = (readWorldMinute(worldTimeMs) + 1) * WORLD_MINUTE_MS;
  let untilDisplayMs = nextMinute - worldTimeMs;
  for (const startsAtMs of slotStarts) {
    const remainingMs = startsAtMs - worldTimeMs;
    if (remainingMs > 0) {
      untilDisplayMs = Math.min(untilDisplayMs, remainingMs % WORLD_MINUTE_MS || WORLD_MINUTE_MS);
    }
  }
  const minuteDelay = Math.max(MIN_DISPLAY_DELAY_MS, Math.ceil(untilDisplayMs / timeScale));
  const boundary = boundaries.find(time => time > worldTimeMs);
  return boundary === undefined ? minuteDelay : Math.min(minuteDelay, Math.ceil((boundary - worldTimeMs) / timeScale));
};

export const isYardClockRefreshDue = (
  prevWorldTimeMs: number,
  currentWorldTimeMs: number,
  prevRefreshMs: number,
  currentMonotonicMs: number,
): boolean => readWorldMinute(currentWorldTimeMs) > readWorldMinute(prevWorldTimeMs)
  && currentMonotonicMs - prevRefreshMs >= MIN_REFRESH_DELAY_MS;

export const readYardSlotMinutes = (startMs: number, worldTimeMs: number): number =>
  Math.max(0, Math.ceil((startMs - worldTimeMs) / WORLD_MINUTE_MS));
