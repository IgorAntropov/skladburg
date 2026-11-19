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
    let farthestZ = 0;
    for (let frame = 0; frame < 240 && isWarehouseDockTruckMoving(truck); frame += 1) {
      advanceWarehouseDockTruck(truck, roads, dock, 0.016);
      farthestZ = Math.min(farthestZ, truck.offsetZ);
    }
    expect(farthestZ).toBeLessThan(roads.entrance.z + 0.2);
    expect(truck).toMatchObject({ offsetZ: -WAREHOUSE_TRUCK_RUNUP, phase: 'away', taskId: undefined });
  });

  it('travels across a wide facade before aligning at the sixth dock and retraces the crossing on departure', () => {
    const wideRoads = buildWarehouseYardRoads([0, -6, 8, 16, 24, 40].map(x => ({ x: x + 12, z: 5 })));
    if (wideRoads === undefined) {
      throw new Error('Expected a six-dock yard');
    }
    const sixth = { x: 40, z: 0 };
    const truck = createWarehouseDockTruck(undefined);
    expect(wideRoads.entrance.x).toBeCloseTo(-3.2);
    startWarehouseDockApproach(truck, 'sixth', wideRoads.entrance.x, wideRoads.entrance.z, sixth, false);
    let rightwardCrossing = 0;
    for (let frame = 0; frame < 240 && isWarehouseDockTruckMoving(truck); frame += 1) {
      const beforeX = truck.offsetX;
      advanceWarehouseDockTruck(truck, wideRoads, sixth, 0.016);
      if (Math.abs(truck.yaw - Math.PI / 2) < 0.001) {
        rightwardCrossing += truck.offsetX - beforeX;
      }
    }
    expect(rightwardCrossing).toBeGreaterThan(20);
    expect(truck).toMatchObject({ offsetX: 0, offsetZ: 0, phase: 'docked', taskId: 'sixth', yaw: 0 });

    startWarehouseDockDeparture(truck);
    let leftwardCrossing = 0;
    for (let frame = 0; frame < 240 && isWarehouseDockTruckMoving(truck); frame += 1) {
      const beforeX = truck.offsetX;
      advanceWarehouseDockTruck(truck, wideRoads, sixth, 0.016);
      if (Math.abs(truck.yaw - Math.PI / 2) < 0.001) {
        leftwardCrossing += beforeX - truck.offsetX;
      }
    }
    expect(leftwardCrossing).toBeGreaterThan(20);
    expect(truck).toMatchObject({ phase: 'away', taskId: undefined });
  });
});
