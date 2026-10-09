export const WORLD_MINUTE_MS = 60_000;

export const getMsIntoWorldMinute = (worldTimeMs: number): number => {
  return ((worldTimeMs % WORLD_MINUTE_MS) + WORLD_MINUTE_MS) % WORLD_MINUTE_MS;
};

export const floorToWorldMinute = (worldTimeMs: number): number => {
  return worldTimeMs - getMsIntoWorldMinute(worldTimeMs);
};
