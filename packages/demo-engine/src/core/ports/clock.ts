import type { IRealTimeSource } from './realTimeSource';

export interface ClockSnapshotValue {
  timeScale: number;
  worldTimeMs: number;
}

export interface CreateScaledClockOptionsValue {
  initial: ClockSnapshotValue;
  realTime: IRealTimeSource;
}

export interface IClock {
  getScale: () => number;
  getSnapshot: () => ClockSnapshotValue;
  now: () => number;
  setScale: (scale: number) => void;
}

const assertValidScale = (scale: number): void => {
  if (!Number.isFinite(scale) || scale < 0) {
    throw new RangeError(`Time scale must be a finite non-negative number, got ${String(scale)}`);
  }
};

const assertValidWorldTime = (worldTimeMs: number): void => {
  if (!Number.isFinite(worldTimeMs)) {
    throw new RangeError(`World time must be a finite number, got ${String(worldTimeMs)}`);
  }
};

export const createScaledClock = (options: CreateScaledClockOptionsValue): IClock => {
  assertValidScale(options.initial.timeScale);
  assertValidWorldTime(options.initial.worldTimeMs);

  let scale = options.initial.timeScale;
  let anchorWorldMs = options.initial.worldTimeMs;
  let anchorRealMs = options.realTime.now();

  const readExactWorldMs = (): number => {
    const elapsedRealMs = Math.max(0, options.realTime.now() - anchorRealMs);

    return anchorWorldMs + elapsedRealMs * scale;
  };

  const now = (): number => Math.floor(readExactWorldMs());

  const setScale = (nextScale: number): void => {
    assertValidScale(nextScale);
    anchorWorldMs = readExactWorldMs();
    anchorRealMs = options.realTime.now();
    scale = nextScale;
  };

  const getSnapshot = (): ClockSnapshotValue => ({ timeScale: scale, worldTimeMs: now() });

  return {
    getScale: (): number => scale,
    getSnapshot,
    now,
    setScale,
  };
};
