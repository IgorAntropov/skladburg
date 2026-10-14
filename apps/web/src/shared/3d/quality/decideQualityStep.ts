import type { FrameWindowValue } from './createFrameSeries';
import type { QualityLevelValue } from './qualityLevel';

import {
  MAX_AUTO_LEVEL_CHANGES,
  MIN_MS_BEFORE_UP,
  SLOW_MEDIAN_MS,
  SMOOTH_P90_RATIO,
} from './autoQualityConstants';
import {
  QUALITY_LEVELS_ASCENDING,
  rankOf,
} from './qualityLevel';

export type QualityStepValue = 'down' | 'stay' | 'up';

interface QualityDecisionStateValue {
  ceiling: QualityLevelValue;
  changeCount: number;
  level: QualityLevelValue;
}

const isWindowSlow = (window: FrameWindowValue): boolean => window.medianMs > SLOW_MEDIAN_MS;

const isWindowSmooth = (window: FrameWindowValue): boolean => {
  return window.medianMs <= SLOW_MEDIAN_MS && window.p90Ms <= window.screenIntervalMs * SMOOTH_P90_RATIO;
};

export const shiftQualityLevel = (level: QualityLevelValue, step: QualityStepValue): QualityLevelValue => {
  const offset = step === 'down' ? -1 : step === 'up' ? 1 : 0;
  const shifted = QUALITY_LEVELS_ASCENDING[rankOf(level) + offset];

  return shifted ?? level;
};

export const decideQualityStep = (
  { ceiling, changeCount, level }: QualityDecisionStateValue,
  msOnLevel: number,
  previous: FrameWindowValue | undefined,
  latest: FrameWindowValue,
): QualityStepValue => {
  if (changeCount >= MAX_AUTO_LEVEL_CHANGES || previous === undefined) {
    return 'stay';
  }

  if (rankOf(level) > 0 && isWindowSlow(previous) && isWindowSlow(latest)) {
    return 'down';
  }

  const isBelowCeiling = rankOf(level) < rankOf(ceiling);

  if (isBelowCeiling && msOnLevel >= MIN_MS_BEFORE_UP && isWindowSmooth(previous) && isWindowSmooth(latest)) {
    return 'up';
  }

  return 'stay';
};
