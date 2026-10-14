import {
  describe,
  expect,
  it,
} from 'vitest';

import type { QualityLevelChangeValue } from './createAutoQualityController';

import { createAutoQualityController } from './createAutoQualityController';
import {
  feedFrames,
  repeatInterval,
  SCREEN_60_MS,
} from './testing/syntheticFrames';

const FRAMES_FOR_ONE_WINDOW = 32;
const FRAMES_FOR_TWO_WINDOWS = 62;
const PAUSE_MS = 500;
const FRAMES_FOR_TEN_SECONDS = 650;

const createHarness = (
  level: 'high' | 'low' | 'medium',
  ceiling: 'high' | 'low' | 'medium' = 'high',
  changeCount = 0,
): {
  changes: QualityLevelChangeValue[];
  controller: ReturnType<typeof createAutoQualityController>;
  gesture: (intervalsMs: readonly number[]) => QualityLevelChangeValue | undefined;
} => {
  const controller = createAutoQualityController({ ceiling, changeCount, level });
  const clock = { now: 1000 };
  const changes: QualityLevelChangeValue[] = [];

  return {
    changes,
    controller,
    gesture: (intervalsMs) => {
      clock.now += PAUSE_MS;
      feedFrames(clock, controller.recordFrame, intervalsMs);

      const change = controller.finishSeries();

      if (change !== undefined) {
        changes.push(change);
        controller.sync({ ceiling, changeCount: changes.length + changeCount, level: change.to });
      }

      return change;
    },
  };
};

describe('createAutoQualityController', () => {
  it('lowers the level after a gesture with steady 33 ms frames', () => {
    const { gesture } = createHarness('high');

    const change = gesture(repeatInterval(33.3, FRAMES_FOR_TWO_WINDOWS));

    expect(change).toMatchObject({ from: 'high', to: 'medium' });
    expect(change?.medianMs).toBeCloseTo(33.3, 5);
  });

  it('applies the decision only when the series ends', () => {
    const { controller } = createHarness('high');

    feedFrames({ now: 1000 }, controller.recordFrame, repeatInterval(33.3, FRAMES_FOR_TWO_WINDOWS));

    expect(controller.finishSeries()).toMatchObject({ from: 'high', to: 'medium' });
    expect(controller.finishSeries()).toBeUndefined();
  });

  it('does not decide on short gestures', () => {
    const { changes, gesture } = createHarness('high');

    for (let index = 0; index < 10; index += 1) {
      gesture(repeatInterval(40, FRAMES_FOR_ONE_WINDOW - 1));
    }

    expect(changes).toEqual([]);
  });

  it('does not count pauses between gestures as slow frames', () => {
    const { changes, controller } = createHarness('high');
    const clock = { now: 1000 };

    for (let index = 0; index < 6; index += 1) {
      clock.now += 2000;
      feedFrames(clock, controller.recordFrame, repeatInterval(SCREEN_60_MS, FRAMES_FOR_ONE_WINDOW));

      const change = controller.finishSeries();

      if (change !== undefined) {
        changes.push(change);
      }
    }

    expect(changes).toEqual([]);
  });

  it('lowers the level on windows that come from different gestures', () => {
    const { gesture } = createHarness('high');

    expect(gesture(repeatInterval(40, FRAMES_FOR_ONE_WINDOW))).toBeUndefined();
    expect(gesture(repeatInterval(40, FRAMES_FOR_ONE_WINDOW))).toMatchObject({ from: 'high', to: 'medium' });
  });

  it('raises the level only after ten seconds of movement on the current level', () => {
    const { gesture } = createHarness('medium');

    expect(gesture(repeatInterval(SCREEN_60_MS, FRAMES_FOR_TWO_WINDOWS))).toBeUndefined();
    expect(gesture(repeatInterval(SCREEN_60_MS, FRAMES_FOR_TEN_SECONDS))).toMatchObject({ from: 'medium', to: 'high' });
  });

  it('starts counting the ten seconds again after a change of level', () => {
    const { gesture } = createHarness('high');

    gesture(repeatInterval(33.3, FRAMES_FOR_TWO_WINDOWS));

    expect(gesture(repeatInterval(SCREEN_60_MS, FRAMES_FOR_TWO_WINDOWS))).toBeUndefined();
    expect(gesture(repeatInterval(SCREEN_60_MS, FRAMES_FOR_TEN_SECONDS))).toMatchObject({ from: 'medium', to: 'high' });
  });

  it('settles after three changes on a sawtooth of slow and fast stretches', () => {
    const { changes, gesture } = createHarness('high');

    for (let index = 0; index < 20; index += 1) {
      gesture(repeatInterval(33.3, FRAMES_FOR_TWO_WINDOWS));
      gesture(repeatInterval(SCREEN_60_MS, FRAMES_FOR_TEN_SECONDS));
    }

    expect(changes).toHaveLength(3);
  });

  it('forgets the measurements when the level is changed from outside', () => {
    const { controller, gesture } = createHarness('high');

    gesture(repeatInterval(40, FRAMES_FOR_ONE_WINDOW));
    controller.sync({ ceiling: 'high', changeCount: 0, level: 'medium' });

    expect(gesture(repeatInterval(40, FRAMES_FOR_ONE_WINDOW))).toBeUndefined();
  });
});
