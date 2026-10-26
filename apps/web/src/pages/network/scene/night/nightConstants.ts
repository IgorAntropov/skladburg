import {
  CITY_RESERVE_RADIUS_METERS,
  MINI_CITY_RADIUS_METERS,
} from '../layout';

export const NIGHT_SALT = {
  lampDelay: 31,
  windowDark: 32,
  windowDelay: 33,
} as const;

export const HOUSE_WINDOW_SIZE_METERS = { height: 0.4, width: 0.36 } as const;

export const WAREHOUSE_WINDOW_SIZE_METERS = { height: 0.26, width: 0.34 } as const;

export const HOUSE_WINDOW_ROW_FRACTIONS: readonly number[] = [0.5];

export const OFFICE_WINDOW_ROW_FRACTIONS: readonly number[] = [0.32, 0.7];

export const WAREHOUSE_WINDOW_CENTER_HEIGHT_METERS = 0.65;

export const WINDOW_SINGLE_WALL_MAX_METERS = 1.4;

export const WINDOW_PAIR_OFFSET_METERS = 0.26;

export const WAREHOUSE_LONG_WALL_MIN_METERS = 1.75;

export const WAREHOUSE_LONG_WALL_OFFSETS_METERS: readonly number[] = [-0.55, 0, 0.55];

export const WAREHOUSE_SHORT_WALL_OFFSETS_METERS: readonly number[] = [-0.3, 0.3];

export const WINDOW_STANDOFF_METERS = 0.02;

export const DARK_WINDOW_SHARE = 0.25;

export const DARK_WINDOW_DELAY = 1;

export const WINDOW_DELAY_RANGE = [0.45, 0.83] as const;

export const FAR_WINDOW_SCALE = 1.2;

export const FAR_WINDOW_MIN_NIGHT = 0.3;

export const WINDOW_DELAY_WEIGHTS = { city: 0.6, hash: 0.15, local: 0.25 } as const;

export const LAMP_DELAY_RANGE = [0.35, 0.58] as const;

export const LAMP_DELAY_WEIGHTS = { distance: 0.7, hash: 0.3 } as const;

export const LAMP_SPACING_METERS = 6;

export const LAMP_MIN_WORK_LENGTH_METERS = 3;

export const LAMP_CITY_CLEARANCE_MARGIN_METERS = CITY_RESERVE_RADIUS_METERS - MINI_CITY_RADIUS_METERS;

export const LAMP_POST_OFFSET_METERS = 1.35;

export const LAMP_POST_SIZE_METERS = 0.1;

export const LAMP_POST_HEIGHT_METERS = 1.5;

export const LAMP_HEAD_SIZE_METERS = { depth: 0.34, height: 0.16, width: 0.34 } as const;

export const LAMP_HEAD_CENTER_HEIGHT_METERS = LAMP_POST_HEIGHT_METERS + LAMP_HEAD_SIZE_METERS.height / 2;

export const LAMP_POOL_OFFSET_METERS = 0.4;

export const LAMP_POOL_HEIGHT_METERS = 0.07;

export const LAMP_POOL_DISC_RADII_METERS: readonly number[] = [1.5, 1.05, 0.6];

export const LAMP_POOL_DISC_STRENGTH = 0.105;

export const LAMP_HALO_SHELL_RADII_METERS: readonly number[] = [0.34, 0.68];

export const LAMP_HALO_SHELL_STRENGTH = 0.085;

export const LAMP_RANK_START = 0.5;

export const LAMP_RANK_STEP = 0.618034;
