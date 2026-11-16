import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  advanceWarehouseDockTruck,
  createWarehouseDockTruck,
  isWarehouseDockTruckMoving,
  syncWarehouseDockTruck,
  WAREHOUSE_TRUCK_RUNUP,
} from './warehouseDockTruckMotion';

describe('warehouse dock truck motion', () => {
  it('backs into the dock on a new task and settles without requesting more frames', () => {
    const truck = createWarehouseDockTruck(undefined);
    syncWarehouseDockTruck(truck, 'pickup', false, false);
    expect(truck).toMatchObject({ offsetZ: -WAREHOUSE_TRUCK_RUNUP, phase: 'approaching' });

    advanceWarehouseDockTruck(truck, 0.016);
    expect(truck.offsetZ).toBeGreaterThan(-WAREHOUSE_TRUCK_RUNUP);
    expect(truck.offsetZ).toBeLessThan(0);
    for (let frame = 0; frame < 120; frame += 1) {
      advanceWarehouseDockTruck(truck, 0.016);
    }
    expect(truck).toMatchObject({ offsetZ: 0, phase: 'docked' });
    expect(isWarehouseDockTruckMoving(truck)).toBe(false);
  });

  it('waits at an already open dock and drives out only after a confirmed close', () => {
    const truck = createWarehouseDockTruck('receipt');
    syncWarehouseDockTruck(truck, 'receipt', true, false);
    expect(truck.phase).toBe('docked');

    syncWarehouseDockTruck(truck, undefined, true, false);
    expect(truck).toMatchObject({ offsetZ: 0, phase: 'departing', taskId: 'receipt' });
    advanceWarehouseDockTruck(truck, 8);
    expect(truck.offsetZ).toBeLessThan(0);
    expect(truck.offsetZ).toBeGreaterThan(-WAREHOUSE_TRUCK_RUNUP);
    const { offsetZ } = truck;
    syncWarehouseDockTruck(truck, undefined, false, false);
    expect(truck.offsetZ).toBe(offsetZ);
    for (let frame = 0; frame < 90; frame += 1) {
      advanceWarehouseDockTruck(truck, 0.016);
    }
    expect(truck).toMatchObject({ offsetZ: -WAREHOUSE_TRUCK_RUNUP, phase: 'away', taskId: undefined });
  });

  it('retains the current position when departure is confirmed during the approach', () => {
    const truck = createWarehouseDockTruck(undefined);
    syncWarehouseDockTruck(truck, 'pickup', false, false);
    for (let frame = 0; frame < 15; frame += 1) {
      advanceWarehouseDockTruck(truck, 0.016);
    }
    const { offsetZ } = truck;
    syncWarehouseDockTruck(truck, undefined, true, false);
    expect(truck).toMatchObject({ offsetZ, phase: 'departing' });
    advanceWarehouseDockTruck(truck, 0.016);
    expect(truck.offsetZ).toBeLessThan(offsetZ);
  });

  it('lets the finished truck depart before the next task approaches the same dock', () => {
    const truck = createWarehouseDockTruck('first');
    syncWarehouseDockTruck(truck, 'second', true, false);
    expect(truck).toMatchObject({ phase: 'departing', taskId: 'first' });
    for (let frame = 0; frame < 100; frame += 1) {
      advanceWarehouseDockTruck(truck, 0.016);
      syncWarehouseDockTruck(truck, 'second', true, false);
    }
    expect(truck).toMatchObject({ phase: 'approaching', taskId: 'second' });
  });

  it('snaps to the selected truck or final pose for reduced motion and unconfirmed removal', () => {
    const truck = createWarehouseDockTruck('first');
    syncWarehouseDockTruck(truck, 'second', false, false);
    expect(truck).toMatchObject({ offsetZ: 0, phase: 'docked', taskId: 'second' });
    syncWarehouseDockTruck(truck, undefined, false, false);
    expect(truck.phase).toBe('away');

    syncWarehouseDockTruck(truck, 'arrival', false, false);
    expect(truck.phase).toBe('approaching');
    syncWarehouseDockTruck(truck, 'arrival', false, true);
    expect(truck).toMatchObject({ offsetZ: 0, phase: 'docked' });
    syncWarehouseDockTruck(truck, undefined, true, true);
    expect(truck.phase).toBe('away');
  });
});
