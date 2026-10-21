export const MAP_CELL_METERS = 12;

export const MAP_EDGE_STRIP_METERS = 8;

export const MINI_CITY_RADIUS_METERS = 6.4;

export const MINI_CITY_SLOT_PITCH_METERS = 3.2;

export const COMPANY_MIN_SPACING_METERS = 3.2;

export const MINI_CITY_BUILDING_MAX_SIDE_METERS = 2;

export const MINI_CITY_MIN_SPACING_METERS = 4;

export const CITY_RESERVE_MARGIN_METERS = 2;

export const ROAD_WIDTH_METERS = 2;

export const ROAD_SHOULDER_METERS = 1;

export const HOME_MARGIN_METERS = 6;

export const HOME_MIN_RADIUS_METERS = 20;

export const DECOR_MIN_COUNT = 5;

export const DECOR_MAX_COUNT = 8;

export const OFFICE_SHARE = 0.3;

export const WAREHOUSE_SIZE_METERS = { depth: 1.5, height: 1.5, width: 2 } as const;

export const HOUSE_SIZE_RANGE_METERS = {
  depth: [1, 1.4],
  height: [1.2, 1.5],
  width: [1.1, 1.6],
} as const;

export const OFFICE_SIZE_RANGE_METERS = {
  depth: [1.2, 1.6],
  height: [1.5, 2],
  width: [1.2, 1.6],
} as const;

export const LAYOUT_SALT = {
  decorCount: 1,
  decorKind: 2,
  decorRank: 3,
  decorRotation: 4,
  decorSize: 5,
  decorSlot: 6,
  roofTint: 11,
  siteOrder: 8,
  siteSlot: 7,
  wallTint: 10,
  warehouseRotation: 9,
} as const;
