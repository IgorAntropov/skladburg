import {
  Matrix4,
  Vector3,
} from 'three';
import {
  expect,
  it,
} from 'vitest';

import {
  createWarehouseDockTruck,
  startWarehouseDockDeparture,
} from './warehouseDockTruckMotion';
import { WAREHOUSE_TRUCK_HEIGHT } from './warehouseTruckDimensions';
import {
  buildWarehouseYardLamps,
  isWarehouseParkingTruckMoving,
  readWarehouseYardHeadlightBeamOwner,
  writeWarehouseHeadlightMatrix,
} from './warehouseYardLighting';
import {
  advanceWarehouseYardMotion,
  syncWarehouseYardMotion,
} from './warehouseYardMotion';
import { buildWarehouseYardRoads } from './warehouseYardRoads';
import { createWarehouseYardTraffic } from './warehouseYardTraffic';

it.each([1, 6])('places the entry and perimeter lights outside the traffic envelopes with %i docks', (count) => {
  const docks = Array.from({ length: count }, (_, index) => ({ x: 9 + index * 6.4, z: 5 }));
  const primary = docks[0];
  const roads = buildWarehouseYardRoads(docks, count === 1 ? 3 : 30);
  if (primary === undefined || roads === undefined) {
    throw new Error('Expected a receiving yard');
  }

  const lamps = buildWarehouseYardLamps(primary, docks, roads);
  expect(lamps.filter(lamp => lamp.isEssential)).toHaveLength(1 + Math.ceil(count / 2));
  expect(lamps.some(lamp => !lamp.isEssential)).toBe(true);
  expect(buildWarehouseYardLamps(primary, docks, roads)).toEqual(lamps);
  for (const { hasMast, height, x, z } of lamps) {
    if (hasMast) {
      expect(roads.parking.every(spot => Math.abs(x - primary.x - spot.x) > 1.5 || Math.abs(z - primary.z - spot.z) > 3.3)).toBe(true);
      expect(Math.abs(x - primary.x - roads.entrance.x)).toBeGreaterThan(3.25);
    }
    else {
      expect(docks.some(dock => x === dock.x && Math.abs(z - dock.z) < 0.7)).toBe(true);
      expect(height).toBeGreaterThan(WAREHOUSE_TRUCK_HEIGHT);
    }
  }
});

it('places the cab lights ahead of the truck and rotates the beam with its yaw', () => {
  const matrix = new Matrix4();
  const point = new Vector3();
  writeWarehouseHeadlightMatrix(matrix, 7, 13, 0, 1);
  point.setFromMatrixPosition(matrix);
  expect(point.x).toBeGreaterThan(7);
  expect(point.z).toBeLessThan(10);

  writeWarehouseHeadlightMatrix(matrix, 7, 13, Math.PI / 2, 0);
  expect(point.setFromMatrixPosition(matrix).x).toBeLessThan(4);
  expect(point.z).toBeCloseTo(13);
  expect(point.set(0, 0, -1).transformDirection(matrix).x).toBeCloseTo(-1);
});

it('lights the moving compact parking queue and gives its single beam to a reserved dock manoeuvre first', () => {
  const traffic = createWarehouseYardTraffic();
  syncWarehouseYardMotion(traffic.yard, ['first', 'second', 'third'], true);
  syncWarehouseYardMotion(traffic.yard, ['second', 'third'], false);
  advanceWarehouseYardMotion(traffic.yard, 0.05);
  const [second, third] = traffic.yard.parked;
  if (second === undefined || third === undefined) {
    throw new Error('Expected two trucks advancing in the parking queue');
  }
  expect(isWarehouseParkingTruckMoving(second, traffic, true)).toBe(true);
  expect(isWarehouseParkingTruckMoving(third, traffic, true)).toBe(true);
  expect(readWarehouseYardHeadlightBeamOwner(traffic, true)).toBe(second);
  expect(readWarehouseYardHeadlightBeamOwner(traffic, false)).toBeUndefined();

  const truck = createWarehouseDockTruck('leaving');
  startWarehouseDockDeparture(truck);
  const lane = { dock: { x: 0, z: 0 }, hasChanged: true, hasConfirmedDeparture: true, target: undefined, truck };
  traffic.reservation = lane;
  expect(isWarehouseParkingTruckMoving(second, traffic, true)).toBe(true);
  expect(readWarehouseYardHeadlightBeamOwner(traffic, true)).toBe(lane);

  traffic.reservation = undefined;
  for (let frame = 0; frame < 60; frame += 1) {
    advanceWarehouseYardMotion(traffic.yard, 0.05);
  }
  expect(isWarehouseParkingTruckMoving(second, traffic, true)).toBe(false);
  expect(readWarehouseYardHeadlightBeamOwner(traffic, true)).toBeUndefined();
});
