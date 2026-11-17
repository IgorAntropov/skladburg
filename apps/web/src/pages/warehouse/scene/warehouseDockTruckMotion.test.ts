import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  advanceWarehouseDockTruck,
  createWarehouseDockTruck,
  isWarehouseDockTruckMoving,
  startWarehouseDockApproach,
  startWarehouseDockDeparture,
} from './warehouseDockTruckMotion';
import {
  buildWarehouseYardRoads,
  WAREHOUSE_TRUCK_RUNUP,
} from './warehouseYardRoads';

const dock = { x: 0, z: 0 };
const roads = buildWarehouseYardRoads([dock]);

describe('warehouse dock truck motion', () => {
  it('backs from the entrance into a new dock and settles without requesting more frames', () => {
    if (roads === undefined) {
      throw new Error('Expected yard roads');
    }

    const truck = createWarehouseDockTruck(undefined);
    const { entrance } = roads;
    startWarehouseDockApproach(truck, 'pickup', entrance.x, entrance.z, dock, false);
    expect(truck).toMatchObject({ offsetX: entrance.x, offsetZ: entrance.z, phase: 'approaching' });
    advanceWarehouseDockTruck(truck, roads, dock, 0.016);
    expect(truck.offsetZ).toBeGreaterThan(entrance.z);
    expect(truck.offsetZ).toBeLessThan(0);
    for (let frame = 0; frame < 180; frame += 1) {
      advanceWarehouseDockTruck(truck, roads, dock, 0.016);
      if (!isWarehouseDockTruckMoving(truck)) {
        break;
      }
    }
    expect(truck).toMatchObject({ offsetX: 0, offsetZ: 0, phase: 'docked', yaw: 0 });
    expect(isWarehouseDockTruckMoving(truck)).toBe(false);
  });

  it('drives out gradually even when the prior frame was an entire tab suspension ago', () => {
    if (roads === undefined) {
      throw new Error('Expected yard roads');
    }

    const truck = createWarehouseDockTruck('receipt');
    expect(truck.phase).toBe('docked');
    startWarehouseDockDeparture(truck);
    expect(truck).toMatchObject({ offsetZ: 0, phase: 'departing', taskId: 'receipt' });
    advanceWarehouseDockTruck(truck, roads, dock, 8);
    expect(truck.offsetZ).toBeLessThan(0);
    expect(truck.offsetZ).toBeGreaterThan(-WAREHOUSE_TRUCK_RUNUP);
    for (let frame = 0; frame < 90 && isWarehouseDockTruckMoving(truck); frame += 1) {
      advanceWarehouseDockTruck(truck, roads, dock, 0.016);
    }
    expect(truck).toMatchObject({ offsetZ: -WAREHOUSE_TRUCK_RUNUP, phase: 'away', taskId: undefined });
  });
});
