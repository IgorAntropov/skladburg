import type { FrameWindowValue } from './createFrameSeries';
import type { QualityStepValue } from './decideQualityStep';
import type { QualityLevelValue } from './qualityLevel';

import {
  FRAME_WINDOW_SIZE,
  IDLE_GAP_MS,
} from './autoQualityConstants';
import { createFrameSeries } from './createFrameSeries';
import {
  decideQualityStep,
  shiftQualityLevel,
} from './decideQualityStep';

export interface AutoQualitySettingsValue {
  ceiling: QualityLevelValue;
  changeCount: number;
}

export interface AutoQualityStateValue extends AutoQualitySettingsValue {
  level: QualityLevelValue;
}

export interface IAutoQualityController {
  finishSeries: () => QualityLevelChangeValue | undefined;
  recordFrame: (timestampMs: number) => void;
  sync: (next: AutoQualityStateValue) => void;
}

export interface QualityLevelChangeValue {
  from: QualityLevelValue;
  medianMs: number;
  to: QualityLevelValue;
}

export const createAutoQualityController = (initial: AutoQualityStateValue): IAutoQualityController => {
  const series = createFrameSeries({ idleGapMs: IDLE_GAP_MS, windowSize: FRAME_WINDOW_SIZE });

  let state: AutoQualityStateValue = initial;
  let previousWindow: FrameWindowValue | undefined;
  let latestWindow: FrameWindowValue | undefined;
  let msOnLevel = 0;
  let pendingStep: QualityStepValue = 'stay';

  const resetLevelMemory = (): void => {
    previousWindow = undefined;
    latestWindow = undefined;
    msOnLevel = 0;
    pendingStep = 'stay';
  };

  const recordFrame = (timestampMs: number): void => {
    const window = series.push(timestampMs);

    if (window === undefined) {
      return;
    }

    previousWindow = latestWindow;
    latestWindow = window;
    msOnLevel += window.durationMs;
    pendingStep = decideQualityStep(state, msOnLevel, previousWindow, window);
  };

  const finishSeries = (): QualityLevelChangeValue | undefined => {
    series.reset();

    const step = pendingStep;

    pendingStep = 'stay';

    if (step === 'stay' || latestWindow === undefined) {
      return undefined;
    }

    const change: QualityLevelChangeValue = {
      from: state.level,
      medianMs: latestWindow.medianMs,
      to: shiftQualityLevel(state.level, step),
    };

    state = { ...state, changeCount: state.changeCount + 1, level: change.to };
    resetLevelMemory();

    return change;
  };

  const sync = (next: AutoQualityStateValue): void => {
    if (next.level !== state.level) {
      resetLevelMemory();
    }

    state = next;
  };

  return { finishSeries, recordFrame, sync };
};
