export const SKELETON_DELAY_MS = 250;

export const SKELETON_MIN_VISIBLE_MS = 400;

export interface SkeletonTimingValue {
  delayMs: number;
  minVisibleMs: number;
}

export const DEFAULT_SKELETON_TIMING: SkeletonTimingValue = {
  delayMs: SKELETON_DELAY_MS,
  minVisibleMs: SKELETON_MIN_VISIBLE_MS,
};
