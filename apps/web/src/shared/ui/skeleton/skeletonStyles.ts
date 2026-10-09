export type SkeletonShapeValue = 'block' | 'circle' | 'line';

export const SKELETON_SHAPE_RADIUS_CLASS_NAMES: Readonly<Record<SkeletonShapeValue, string>> = {
  block: 'rounded-panel',
  circle: 'rounded-full',
  line: 'rounded-control',
};

export const SKELETON_SHAPE_SIZE_CLASS_NAMES: Readonly<Record<SkeletonShapeValue, string>> = {
  block: 'h-24 w-full',
  circle: 'size-10',
  line: 'h-4 w-full',
};

export const SKELETON_EMPTY_CLASS_NAME = 'bg-transparent';

export const SKELETON_FILLED_CLASS_NAME = 'bg-skeleton motion-safe:animate-skeleton-pulse';
