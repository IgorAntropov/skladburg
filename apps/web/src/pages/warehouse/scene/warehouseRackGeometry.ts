import type { WarehouseRackFootprintValue } from '../model/warehouseRackGrid';
import type {
  WarehouseBoxValue,
  WarehouseFloorValue,
} from './warehouseLayout';

type WarehouseFloorFootprintValue = Omit<WarehouseRackFootprintValue, 'origin'> & {
  origin?: undefined | WarehouseRackFootprintValue['origin'];
};

export const WAREHOUSE_MM_PER_METER = 1000;
export const WAREHOUSE_RACK_MIN_HEIGHT = 0.8;
export const WAREHOUSE_RACK_HEADROOM = 0.75;

export const readWarehouseFloor = (rect: undefined | WarehouseFloorFootprintValue): undefined | WarehouseFloorValue => {
  if (rect?.origin === undefined || rect.widthMm === 0 || rect.depthMm === 0) {
    return undefined;
  }

  return {
    depth: rect.depthMm / WAREHOUSE_MM_PER_METER,
    width: rect.widthMm / WAREHOUSE_MM_PER_METER,
    x: rect.origin.xMm / WAREHOUSE_MM_PER_METER,
    z: rect.origin.zMm / WAREHOUSE_MM_PER_METER,
  };
};

export const getWarehouseRackFrameWidth = (width: number): number => Math.min(0.09, width * 0.14);

export const buildWarehouseRackDeck = (
  x: number, z: number, width: number, depth: number, elevation: number,
): WarehouseBoxValue => ({
  position: [x, elevation + 0.088, z],
  size: [width, 0.15, depth],
});

export const buildWarehouseRackFrame = (
  x: number, z: number, frameWidth: number, depth: number, height: number,
): WarehouseBoxValue => ({
  position: [x, height / 2, z],
  size: [frameWidth, height, depth],
});

export const buildWarehouseRackPosts = (frames: readonly WarehouseBoxValue[]): WarehouseBoxValue[] => frames.flatMap(
  ({ position: [x, y, z], size: [width, height, depth] }): WarehouseBoxValue[] => {
    const thickness = Math.min(0.055, depth / 4);

    return [-1, 1].map(direction => ({
      position: [x, y, z + direction * (depth - thickness) / 2],
      size: [width * 0.65, height, thickness],
    }));
  },
);
