interface WarehouseYardLightTimeValue {
  isNight: boolean;
  nextBoundaryMs: number;
}

const DAY_START_HOUR = 6;
const NIGHT_START_HOUR = 18;
const HOUR_MS = 3_600_000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const ELAPSED_BOUNDARY_RECHECK_MS = 250;

const createHourFormatter = (timeZone: string): Intl.DateTimeFormat => new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone,
});

export const readWarehouseYardLightTime = (worldTimeMs: number, timeZone: string): WarehouseYardLightTimeValue => {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = createHourFormatter(timeZone);
  }
  catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
    formatter = createHourFormatter('UTC');
  }

  const isNightAt = (timeMs: number): boolean => {
    const hour = Number(formatter.format(timeMs));
    return hour < DAY_START_HOUR || hour >= NIGHT_START_HOUR;
  };

  let before = Math.floor(worldTimeMs);
  let after = before + HOUR_MS;
  const isNight = isNightAt(before);
  while (isNightAt(after) === isNight) {
    before = after;
    after += HOUR_MS;
  }

  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (isNightAt(middle) === isNight) {
      before = middle;
    }
    else {
      after = middle;
    }
  }

  return { isNight, nextBoundaryMs: after };
};

export const readWarehouseYardLightDelay = (boundaryMs: number, worldTimeMs: number, timeScale: number): number | undefined => {
  if (!Number.isFinite(timeScale) || timeScale <= 0) {
    return undefined;
  }

  const delay = Math.ceil((boundaryMs - worldTimeMs) / timeScale);

  return delay <= 0 ? ELAPSED_BOUNDARY_RECHECK_MS : Math.min(delay, MAX_TIMEOUT_MS);
};
