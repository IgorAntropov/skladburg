import type { NetworkSceneBuildingKindValue } from '../layout';

import {
  HOUSE_WINDOW_ROW_FRACTIONS,
  HOUSE_WINDOW_SIZE_METERS,
  OFFICE_WINDOW_ROW_FRACTIONS,
  WAREHOUSE_LONG_WALL_MIN_METERS,
  WAREHOUSE_LONG_WALL_OFFSETS_METERS,
  WAREHOUSE_SHORT_WALL_OFFSETS_METERS,
  WAREHOUSE_WINDOW_CENTER_HEIGHT_METERS,
  WAREHOUSE_WINDOW_SIZE_METERS,
  WINDOW_PAIR_OFFSET_METERS,
  WINDOW_SINGLE_WALL_MAX_METERS,
} from './nightConstants';

export interface WindowSlotValue {
  height: number;
  offset: number;
  rise: number;
  width: number;
}

const PAIR_OFFSETS: readonly number[] = [-WINDOW_PAIR_OFFSET_METERS, WINDOW_PAIR_OFFSET_METERS];

const SINGLE_OFFSETS: readonly number[] = [0];

export const getWallSlots = (kind: NetworkSceneBuildingKindValue, wallLength: number, wallHeight: number): WindowSlotValue[] => {
  if (kind === 'warehouse') {
    const offsets = wallLength >= WAREHOUSE_LONG_WALL_MIN_METERS
      ? WAREHOUSE_LONG_WALL_OFFSETS_METERS
      : WAREHOUSE_SHORT_WALL_OFFSETS_METERS;

    return offsets.map(offset => ({ ...WAREHOUSE_WINDOW_SIZE_METERS, offset, rise: WAREHOUSE_WINDOW_CENTER_HEIGHT_METERS }));
  }

  const fractions = kind === 'office' ? OFFICE_WINDOW_ROW_FRACTIONS : HOUSE_WINDOW_ROW_FRACTIONS;
  const offsets = wallLength < WINDOW_SINGLE_WALL_MAX_METERS ? SINGLE_OFFSETS : PAIR_OFFSETS;

  return fractions.flatMap(fraction => offsets.map(offset => ({
    ...HOUSE_WINDOW_SIZE_METERS,
    offset,
    rise: fraction * wallHeight,
  })));
};
