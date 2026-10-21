import {
  CORNER_APPEAR_OFFSET_METERS,
  CORNER_APPEAR_SECONDS,
  CORNER_FRAME_STEP_LIMIT_SECONDS,
} from './networkSceneMetrics';

export interface CornerAnimationValue {
  elapsed: number;
  isActive: boolean;
  isStarted: boolean;
}

export const createCornerAnimation = (isActive: boolean): CornerAnimationValue => ({
  elapsed: 0,
  isActive,
  isStarted: false,
});

export const isCornerAnimationRunning = (animation: CornerAnimationValue): boolean => animation.isActive;

export const isCornerAppearFinished = (elapsedSeconds: number): boolean => elapsedSeconds >= CORNER_APPEAR_SECONDS;

export const resolveCornerSpread = (elapsedSeconds: number): number => {
  const progress = Math.min(1, Math.max(0, elapsedSeconds / CORNER_APPEAR_SECONDS));

  return CORNER_APPEAR_OFFSET_METERS * (1 - progress) ** 3;
};

export const stepCornerAnimation = (animation: CornerAnimationValue, delta: number): number => {
  if (animation.isStarted) {
    animation.elapsed += Math.min(Math.max(delta, 0), CORNER_FRAME_STEP_LIMIT_SECONDS);
  }

  animation.isStarted = true;

  if (isCornerAppearFinished(animation.elapsed)) {
    animation.isActive = false;
  }

  return resolveCornerSpread(animation.elapsed);
};
