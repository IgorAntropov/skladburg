import type { QualityLevelValue } from '@/shared/3d';

export const WALL_BEVEL_RADII = { x: 0.07, y: 0.06, z: 0.07 } as const;

export const SLAB_BEVEL_RADII = { x: 0.06, y: 0.3, z: 0.06 } as const;

export const WALL_BOTTOM_SHADE = 0.62;

export const WALL_SHADE_HEIGHT = 0.55;

export const NO_SHADE = 1;

export const GABLE_BEVEL = 0.05;

export const GABLE_EAVE_SHADE = 0.86;

export const GABLE_SHADE_HEIGHT = 0.6;

export const BEVEL_SEGMENTS_BY_LEVEL: Readonly<Record<QualityLevelValue, number>> = {
  high: 2,
  low: 1,
  medium: 1,
};
