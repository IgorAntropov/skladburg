export const WAREHOUSE_YARD_PARKING_LIMIT = 3;

const FIRST_PARKING_OFFSET = -20;
export const WAREHOUSE_YARD_PARKING_SPACING = 7.15;

export const readWarehouseParkingOffset = (index: number): number => FIRST_PARKING_OFFSET - index * WAREHOUSE_YARD_PARKING_SPACING;

export const WAREHOUSE_YARD_PARKING_ENTRANCE = readWarehouseParkingOffset(WAREHOUSE_YARD_PARKING_LIMIT);
