export interface EngineSeedValue {
  randomSeed: number;
  worldStartMs: number;
}

export const SEED_VERSION = 12;
export const SEED_TIME_SCALE = 1;
export const SEED_WORLD_START_MS = Date.UTC(2026, 9, 12, 6, 0, 0);
export const SEED_RANDOM_SEED = 20261012;
export const SEED_TRACE_RANDOM_SALT = 0x74726163;

export const DEFAULT_ENGINE_SEED: EngineSeedValue = {
  randomSeed: SEED_RANDOM_SEED,
  worldStartMs: SEED_WORLD_START_MS,
};
