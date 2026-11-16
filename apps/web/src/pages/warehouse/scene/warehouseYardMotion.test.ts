import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  advanceWarehouseDockTruck,
  createWarehouseDockTruck,
  syncWarehouseDockTruck,
} from './warehouseDockTruckMotion';
import {
  advanceWarehouseYardMotion,
  createWarehouseYardMotion,
  readWarehouseYardTruckOffset,
  syncWarehouseYardMotion,
} from './warehouseYardMotion';
import { readWarehouseParkingOffset } from './warehouseYardParking';

const visits = ['dock', 'first', 'second', 'third', 'outside'].map(taskId => ({ taskId, tripId: undefined }));
const pending = visits.slice(1);

describe('warehouse yard parking motion', () => {
  it('holds the first waiting truck until departure ends and promotes it from its parking position', () => {
    const yard = createWarehouseYardMotion();
    const truck = createWarehouseDockTruck('dock');
    syncWarehouseYardMotion(yard, visits, truck.taskId, false);
    expect(yard.visible.map(slot => slot.taskId)).toEqual(['first', 'second', 'third']);

    syncWarehouseDockTruck(truck, 'first', true, false, readWarehouseYardTruckOffset(yard, 'first'));
    expect(truck).toMatchObject({ phase: 'departing', taskId: 'dock' });
    syncWarehouseYardMotion(yard, pending, truck.taskId, false);
    expect(readWarehouseYardTruckOffset(yard, 'first')).toBe(readWarehouseParkingOffset(0));
    expect(yard.isMoving).toBe(false);
    for (let frame = 0; frame < 30; frame += 1) {
      advanceWarehouseDockTruck(truck, 0.05);
    }

    syncWarehouseDockTruck(truck, 'first', true, false, readWarehouseYardTruckOffset(yard, 'first'));
    expect(truck).toMatchObject({ offsetZ: readWarehouseParkingOffset(0), phase: 'approaching', taskId: 'first' });
    syncWarehouseYardMotion(yard, pending, truck.taskId, false);
    expect(readWarehouseYardTruckOffset(yard, 'first')).toBeUndefined();
    expect(readWarehouseYardTruckOffset(yard, 'outside')).toBeUndefined();

    for (let frame = 0; frame < 60; frame += 1) {
      advanceWarehouseDockTruck(truck, 0.05);
      advanceWarehouseYardMotion(yard, 0.05);
      syncWarehouseYardMotion(yard, pending, truck.taskId, false, truck.offsetZ);
      expect(truck.offsetZ - (yard.visible[0]?.offsetZ ?? 0)).toBeGreaterThan(6.3);
      for (let index = 1; index < yard.visible.length; index += 1) {
        expect((yard.visible[index - 1]?.offsetZ ?? 0) - (yard.visible[index]?.offsetZ ?? 0)).toBeGreaterThan(6.3);
      }
    }
    expect(yard.visible.map(slot => slot.taskId)).toEqual(['second', 'third', 'outside']);
    expect(yard.visible.map(slot => slot.offsetZ)).toEqual([0, 1, 2].map(readWarehouseParkingOffset));
    expect(yard.isMoving).toBe(false);
    expect(truck.phase).toBe('docked');
  });

  it('keeps clear of a truck from the back after two waiting tasks close together', () => {
    const yard = createWarehouseYardMotion();
    const truck = createWarehouseDockTruck('dock');
    const queued = [...visits, { taskId: 'last', tripId: undefined }];
    const remaining = queued.slice(3);
    syncWarehouseYardMotion(yard, queued, truck.taskId, false, truck.offsetZ);
    syncWarehouseDockTruck(truck, 'third', true, false);
    for (let frame = 0; frame < 27; frame += 1) {
      advanceWarehouseDockTruck(truck, 0.05);
    }
    syncWarehouseYardMotion(yard, remaining, truck.taskId, false, truck.offsetZ);
    syncWarehouseDockTruck(truck, 'third', true, false, readWarehouseYardTruckOffset(yard, 'third'));
    expect(truck.offsetZ).toBe(readWarehouseParkingOffset(2));
    syncWarehouseYardMotion(yard, remaining, truck.taskId, false, truck.offsetZ);
    expect(yard.visible).toHaveLength(0);

    for (let frame = 0; frame < 60; frame += 1) {
      advanceWarehouseDockTruck(truck, 0.05);
      advanceWarehouseYardMotion(yard, 0.05);
      syncWarehouseYardMotion(yard, remaining, truck.taskId, false, truck.offsetZ);
      for (const waiting of yard.visible) {
        expect(truck.offsetZ - waiting.offsetZ).toBeGreaterThan(6.3);
      }
    }
    expect(yard.visible.map(slot => slot.taskId)).toEqual(['outside', 'last']);
  });

  it('settles into the nearest free spaces immediately with reduced motion', () => {
    const yard = createWarehouseYardMotion();
    syncWarehouseYardMotion(yard, visits, 'dock', false);
    syncWarehouseYardMotion(yard, pending, 'first', false);
    advanceWarehouseYardMotion(yard, 0.05);
    expect(yard.isMoving).toBe(true);
    syncWarehouseYardMotion(yard, pending, 'first', true);
    expect(yard.visible.map(slot => slot.offsetZ)).toEqual([0, 1, 2].map(readWarehouseParkingOffset));
    expect(yard.isMoving).toBe(false);
  });
});
