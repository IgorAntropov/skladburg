import {
  WAREHOUSE_YARD_MAX_PARKING_LIMIT,
  WAREHOUSE_YARD_PARKING_LIMIT,
} from '../model/warehouseSceneParking';

export {
  WAREHOUSE_YARD_MAX_PARKING_LIMIT,
  WAREHOUSE_YARD_PARKING_LIMIT,
} from '../model/warehouseSceneParking';

interface WarehouseYardParkingSpotValue {
  x: number;
  z: number;
}

const FIRST_PARKING_OFFSET = -20;
export const WAREHOUSE_YARD_PARKING_SPACING = 7.15;

export const readWarehouseParkingOffset = (index: number): number => FIRST_PARKING_OFFSET - index * WAREHOUSE_YARD_PARKING_SPACING;

export const WAREHOUSE_YARD_PARKING_ENTRANCE = readWarehouseParkingOffset(WAREHOUSE_YARD_PARKING_LIMIT);

export const readWarehouseParkingCapacity = (count: number): number =>
  Math.max(WAREHOUSE_YARD_PARKING_LIMIT, Math.min(WAREHOUSE_YARD_MAX_PARKING_LIMIT, Math.floor(count)));

export const buildWarehouseParking = (count: number, oppositeX: number): WarehouseYardParkingSpotValue[] => (
  Array.from({ length: count }, (_unused, index) => {
    if (index < 2 * WAREHOUSE_YARD_PARKING_LIMIT) {
      return {
        x: index < WAREHOUSE_YARD_PARKING_LIMIT ? 0 : oppositeX,
        z: readWarehouseParkingOffset(index % WAREHOUSE_YARD_PARKING_LIMIT),
      };
    }
    return { x: index % 2 === 0 ? 0 : oppositeX, z: readWarehouseParkingOffset(Math.floor(index / 2)) };
  })
);
