import {
  describe,
  expect,
  it,
} from 'vitest';

import type { FrameWindowValue } from './createFrameSeries';
import type { QualityLevelValue } from './qualityLevel';

import { decideQualityStep } from './decideQualityStep';

const createWindow = (medianMs: number, p90Ms: number, screenIntervalMs: number): FrameWindowValue => ({
  durationMs: medianMs * 30,
  medianMs,
  p90Ms,
  screenIntervalMs,
});

const SLOW = createWindow(33.3, 33.3, 33.3);
const SMOOTH_60 = createWindow(16.7, 16.7, 16.7);
const SMOOTH_120 = createWindow(8.3, 8.3, 8.3);
const MIXED_120 = createWindow(11, 16.7, 8.3);
const WITH_DROPS_60 = createWindow(16.7, 33.3, 16.7);

const TEN_SECONDS_MS = 10_000;

const state = (
  level: QualityLevelValue,
  ceiling: QualityLevelValue = 'high',
  changeCount = 0,
): { ceiling: QualityLevelValue; changeCount: number; level: QualityLevelValue } => ({ ceiling, changeCount, level });

describe('decideQualityStep', () => {
  it('steps down after two slow windows in a row', () => {
    expect(decideQualityStep(state('high'), 0, SLOW, SLOW)).toBe('down');
  });

  it('does not step down on a single slow window', () => {
    expect(decideQualityStep(state('high'), 0, undefined, SLOW)).toBe('stay');
  });

  it('does not step down when only one of the last two windows is slow', () => {
    expect(decideQualityStep(state('high'), 0, SLOW, SMOOTH_60)).toBe('stay');
    expect(decideQualityStep(state('high'), 0, SMOOTH_60, SLOW)).toBe('stay');
  });

  it('does not step down at 60 Hz, at 120 Hz and on a 120 Hz mix', () => {
    for (const window of [SMOOTH_60, SMOOTH_120, MIXED_120]) {
      expect(decideQualityStep(state('high'), TEN_SECONDS_MS, window, window)).toBe('stay');
    }
  });

  it('never steps below low', () => {
    expect(decideQualityStep(state('low'), 0, SLOW, SLOW)).toBe('stay');
  });

  it('steps up after ten seconds of movement and two smooth windows below the ceiling', () => {
    expect(decideQualityStep(state('medium', 'high', 1), TEN_SECONDS_MS, SMOOTH_60, SMOOTH_60)).toBe('up');
  });

  it('steps up on a 120 Hz screen with smooth windows', () => {
    expect(decideQualityStep(state('low', 'high', 1), TEN_SECONDS_MS, SMOOTH_120, SMOOTH_120)).toBe('up');
  });

  it('does not step up before ten seconds of movement', () => {
    expect(decideQualityStep(state('medium', 'high', 1), TEN_SECONDS_MS - 1, SMOOTH_60, SMOOTH_60)).toBe('stay');
  });

  it('never steps above the ceiling', () => {
    expect(decideQualityStep(state('medium', 'medium', 1), TEN_SECONDS_MS * 6, SMOOTH_60, SMOOTH_60)).toBe('stay');
    expect(decideQualityStep(state('low', 'low'), TEN_SECONDS_MS * 6, SMOOTH_60, SMOOTH_60)).toBe('stay');
  });

  it('does not step up when windows have dropped frames or a 120 Hz mix', () => {
    for (const window of [WITH_DROPS_60, MIXED_120]) {
      expect(decideQualityStep(state('low', 'high', 1), TEN_SECONDS_MS, window, window)).toBe('stay');
    }
  });

  it('does not step up when the screen itself runs slow', () => {
    expect(decideQualityStep(state('low', 'high', 1), TEN_SECONDS_MS, SLOW, SLOW)).toBe('stay');
  });

  it('keeps the level once three automatic changes happened', () => {
    expect(decideQualityStep(state('high', 'high', 3), TEN_SECONDS_MS, SLOW, SLOW)).toBe('stay');
    expect(decideQualityStep(state('low', 'high', 3), TEN_SECONDS_MS, SMOOTH_60, SMOOTH_60)).toBe('stay');
  });
});
