export interface WorldClockReadingValue {
  receivedAtMs: number;
  snapshot: WorldClockSnapshotValue;
}

export interface WorldClockSnapshotValue {
  timeScale: number;
  worldTimeMs: number;
}
