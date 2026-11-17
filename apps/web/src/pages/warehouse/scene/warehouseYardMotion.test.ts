import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  advanceWarehouseYardMotion,
  createWarehouseYardMotion,
  syncWarehouseYardMotion,
} from './warehouseYardMotion';
import {
  readWarehouseParkingOffset,
  WAREHOUSE_YARD_PARKING_SPACING,
} from './warehouseYardParking';

describe('warehouse yard parking motion', () => {
  it('advances the existing queue without hiding trucks and fills the last space from the entrance', () => {
    const yard = createWarehouseYardMotion();
    syncWarehouseYardMotion(yard, ['first', 'second', 'third'], false);
    expect(yard.parked.map(slot => slot.offsetZ)).toEqual([0, 1, 2].map(readWarehouseParkingOffset));

    syncWarehouseYardMotion(yard, ['second', 'third', 'outside'], false);
    expect(yard.parked.map(slot => slot.offsetZ)).toEqual([1, 2, 3].map(readWarehouseParkingOffset));
    for (let frame = 0; frame < 60; frame += 1) {
      advanceWarehouseYardMotion(yard, 0.05);
      syncWarehouseYardMotion(yard, ['second', 'third', 'outside'], false);
      const [first, second, third] = yard.parked.map(slot => slot.offsetZ);
      expect((first ?? 0) - (second ?? 0)).toBeCloseTo(WAREHOUSE_YARD_PARKING_SPACING);
      expect((second ?? 0) - (third ?? 0)).toBeCloseTo(WAREHOUSE_YARD_PARKING_SPACING);
    }
    expect(yard.parked.map(slot => slot.taskId)).toEqual(['second', 'third', 'outside']);
    expect(yard.parked.map(slot => slot.offsetZ)).toEqual([0, 1, 2].map(readWarehouseParkingOffset));
    expect(yard.isMoving).toBe(false);
  });

  it('settles into the nearest free spaces immediately with reduced motion', () => {
    const yard = createWarehouseYardMotion();
    syncWarehouseYardMotion(yard, ['first', 'second', 'third'], false);
    syncWarehouseYardMotion(yard, ['second', 'third', 'outside'], false);
    advanceWarehouseYardMotion(yard, 0.05);
    expect(yard.isMoving).toBe(true);
    syncWarehouseYardMotion(yard, ['second', 'third', 'outside'], true);
    expect(yard.parked.map(slot => slot.offsetZ)).toEqual([0, 1, 2].map(readWarehouseParkingOffset));
    expect(yard.isMoving).toBe(false);
  });
});
