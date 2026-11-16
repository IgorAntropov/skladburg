export const WAREHOUSE_YARD_PARKING_LIMIT = 3;

const FIRST_PARKING_OFFSET = -10.4;
const PARKING_SPACING = 7.15;

export const readWarehouseParkingOffset = (index: number): number => FIRST_PARKING_OFFSET - index * PARKING_SPACING;
