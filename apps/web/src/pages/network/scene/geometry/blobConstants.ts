import type { SoftBlobOptionsValue } from './createSoftBlobGeometry';

export const BUILDING_BLOB_MARGIN_METERS = 0.24;

export const BUILDING_BLOB_LIFT_METERS = 0.008;

export const BUILDING_BLOB_OPACITY = 0.46;

export const BUILDING_BLOB_SHADOWED_OPACITY = 0.32;

export const TREE_BLOB_LIFT_METERS = 0.07;

export const TREE_BLOB_OPACITY = 0.34;

export const TREE_BLOB_CROWN_RADIUS_METERS = { conifer: 1.05, deciduous: 1.15 } as const;

export const TREE_BLOB_RADIUS_SHARE = 0.92;

export const BLOB_POLYGON_OFFSET = -2;

export const BUILDING_BLOB_OPTIONS: SoftBlobOptionsValue = {
  alphas: [1, 1, 0.45, 0],
  exponent: 0.55,
  radiusShares: [0.6, 0.82, 1],
  segments: 16,
};

export const TREE_BLOB_OPTIONS: SoftBlobOptionsValue = {
  alphas: [1, 0.65, 0],
  exponent: 1,
  radiusShares: [0.55, 1],
  segments: 8,
};
