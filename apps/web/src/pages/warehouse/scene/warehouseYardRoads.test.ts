import {
  describe,
  expect,
  it,
} from 'vitest';

import { readWarehouseParkingOffset } from './warehouseYardParking';
import {
  buildWarehouseYardRoads,
  readWarehouseYardApproach,
} from './warehouseYardRoads';

describe('warehouse yard roads', () => {
  it('connects the shared entrance and all parking spots to both ramps', () => {
    const docks = [{ x: 2, z: 4 }, { x: 8.2, z: 4 }];
    const roads = buildWarehouseYardRoads(docks);
    if (roads === undefined) {
      throw new Error('Expected yard roads');
    }

    for (const dock of docks) {
      const destination = { x: dock.x - 2, z: 0 };
      for (const start of [roads.entrance, ...[0, 1, 2].map(index => ({ x: 0, z: readWarehouseParkingOffset(index) }))]) {
        const pose = { offsetX: 0, offsetZ: 0, yaw: 0 };
        readWarehouseYardApproach(roads, start, destination, start.z, pose, false);
        expect(pose).toEqual({ offsetX: start.x - destination.x, offsetZ: start.z, yaw: 0 });

        readWarehouseYardApproach(roads, start, destination, (roads.junctionZ + roads.throatZ) / 2, pose, false);
        expect(pose.offsetX).toBeCloseTo((start.x - destination.x) / 2);
        if (start.x !== destination.x) {
          expect(Math.sign(pose.yaw)).toBe(Math.sign(destination.x - start.x));
        }

        readWarehouseYardApproach(roads, start, destination, 0, pose, false);
        expect(pose).toEqual({ offsetX: 0, offsetZ: 0, yaw: 0 });
      }
    }
  });

  it('allows the whole turning truck to clear occupied parking and dock positions', () => {
    const roads = buildWarehouseYardRoads([{ x: 0, z: 0 }, { x: 6.2, z: 0 }]);
    if (roads === undefined) {
      throw new Error('Expected yard roads');
    }
    const parkedRear = readWarehouseParkingOffset(0);
    const dockedFront = -6.1;
    const pose = { offsetX: 0, offsetZ: 0, yaw: 0 };
    for (const start of [roads.entrance, { x: 0, z: parkedRear }]) {
      for (const x of [0, 6.2]) {
        for (let step = 0; step <= 100; step += 1) {
          const z = roads.junctionZ + (roads.throatZ - roads.junctionZ) * step / 100;
          readWarehouseYardApproach(roads, start, { x, z: 0 }, z, pose, false);
          const extent = Math.abs(Math.cos(pose.yaw)) * 3.1 + Math.abs(Math.sin(pose.yaw)) * 0.95;
          expect(z - 3 - extent).toBeGreaterThan(parkedRear);
          expect(z - 3 + extent).toBeLessThan(dockedFront);
        }
      }
    }
  });
});
