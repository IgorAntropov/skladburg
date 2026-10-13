export const ISOMETRIC_AZIMUTH_RADIANS = Math.PI / 4;

export const ISOMETRIC_ELEVATION_RADIANS = Math.atan(1 / Math.SQRT2);

export const ISOMETRIC_POLAR_RADIANS = Math.PI / 2 - ISOMETRIC_ELEVATION_RADIANS;

export const QUARTER_TURN_RADIANS = Math.PI / 2;

export const DEFAULT_FIT_MARGIN_RATIO = 0.06;

export const MAX_ZOOM_FACTOR = 6;

export const ZOOM_STEP_FACTOR = 1.5;

export const MAX_FRAME_DELTA_S = 1 / 30;

export const CAMERA_SMOOTH_TIME_S = 0.14;

export const FOLLOW_FRAME_PRIORITY = -2;
