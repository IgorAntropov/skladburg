import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WorldClockSnapshotValue } from './worldClockTypes';

import { projectWorldTime } from './projectWorldTime';

const WORLD_START_MS = Date.UTC(2026, 9, 9, 12, 0, 0);
const RECEIVED_AT_MS = 5000;

const createSnapshot = (timeScale: number): WorldClockSnapshotValue => ({ timeScale, worldTimeMs: WORLD_START_MS });

describe('projectWorldTime', () => {
  it('returns the received world time when no real time has passed', () => {
    expect(projectWorldTime(createSnapshot(1), RECEIVED_AT_MS, RECEIVED_AT_MS)).toBe(WORLD_START_MS);
  });

  it('moves the world one to one with the real time at the scale 1', () => {
    expect(projectWorldTime(createSnapshot(1), RECEIVED_AT_MS, RECEIVED_AT_MS + 90_000)).toBe(WORLD_START_MS + 90_000);
  });

  it('moves the world sixty times faster at the scale 60', () => {
    expect(projectWorldTime(createSnapshot(60), RECEIVED_AT_MS, RECEIVED_AT_MS + 1500)).toBe(WORLD_START_MS + 90_000);
  });

  it('keeps the world still at the scale 0', () => {
    expect(projectWorldTime(createSnapshot(0), RECEIVED_AT_MS, RECEIVED_AT_MS + 600_000)).toBe(WORLD_START_MS);
  });

  it('supports a fractional scale', () => {
    expect(projectWorldTime(createSnapshot(0.5), RECEIVED_AT_MS, RECEIVED_AT_MS + 10_000)).toBe(WORLD_START_MS + 5000);
  });

  it('does not move the world back when the clock reads earlier than the receive moment', () => {
    expect(projectWorldTime(createSnapshot(60), RECEIVED_AT_MS, RECEIVED_AT_MS - 100)).toBe(WORLD_START_MS);
  });

  it('works for a world time before the epoch', () => {
    expect(projectWorldTime({ timeScale: 1, worldTimeMs: -90_000 }, 0, 30_000)).toBe(-60_000);
  });
});
