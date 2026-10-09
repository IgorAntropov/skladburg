import type { WorldClockSnapshotValue } from './worldClockTypes';

export const projectWorldTime = (snapshot: WorldClockSnapshotValue, receivedAtMs: number, nowMs: number): number => {
  const elapsedRealMs = Math.max(0, nowMs - receivedAtMs);

  return snapshot.worldTimeMs + elapsedRealMs * snapshot.timeScale;
};
