import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WarehouseDockPointValue } from './warehouseLayout';

import {
  readWarehouseParkingOffset,
  WAREHOUSE_YARD_PARKING_LIMIT,
} from './warehouseYardParking';
import {
  buildWarehouseYardRoads,
  readWarehouseParkingArrival,
  readWarehouseParkingExit,
  readWarehouseYardApproach,
  WAREHOUSE_PARKING_EXIT_ADVANCE,
  WAREHOUSE_TRUCK_CENTER_Z,
} from './warehouseYardRoads';

const truckHalfWidth = 0.95;
const truckHalfLength = 3.1;
const parking = Array.from({ length: WAREHOUSE_YARD_PARKING_LIMIT }, (_unused, index) => ({ x: 0, z: readWarehouseParkingOffset(index) }));
const samples = 240;
const scenarios = [
  { dockOffsets: [0], origin: { x: 2, z: 0 } },
  { dockOffsets: [0, 6.2], origin: { x: 1, z: 4 } },
  { dockOffsets: [0, -2.66, 2.66, -9, 19, 53], origin: { x: 20, z: 7 } },
];

describe('warehouse yard roads', () => {
  it('retains the original three places and grows two stable rows without exceeding fifteen places each', () => {
    const docks = [{ x: 2, z: 4 }];
    const compact = buildWarehouseYardRoads(docks);
    const full = buildWarehouseYardRoads(docks, 31);
    if (compact === undefined || full === undefined) {
      throw new Error('Expected parking layouts');
    }

    expect(compact.parking).toEqual(parking);
    expect(full.parking.slice(0, 3)).toEqual(parking);
    expect(full.parking).toHaveLength(30);
    const rows = new Map<number, number>();
    for (const { x } of full.parking) {
      rows.set(x, (rows.get(x) ?? 0) + 1);
    }
    expect(Array.from(rows.values())).toEqual([15, 15]);
    expect(full.parking.slice(3, 6).map(({ z }) => z)).toEqual(parking.map(({ z }) => z));
    for (const capacity of [4, 20, 25, 30]) {
      const yard = buildWarehouseYardRoads(docks, capacity);
      expect(yard?.parking).toEqual(full.parking.slice(0, capacity));
      expect(yard?.entrance.x).toBe(full.entrance.x);
    }
  });

  it.each(scenarios)('clears the occupied rows on all parking and dock routes for $dockOffsets', ({ dockOffsets, origin }) => {
    const docks = dockOffsets.map(x => ({ x, z: 0 }));
    const roads = buildWarehouseYardRoads(docks.map(({ x, z }) => ({ x: x + origin.x, z: z + origin.z })), 30);
    if (roads === undefined) {
      throw new Error('Expected a full parking layout');
    }
    expect(roads.parking).toHaveLength(30);

    const dockOrigin = { x: 0, z: 0 };
    const pose = { offsetX: 0, offsetZ: 0, yaw: 0 };
    for (const spot of roads.parking) {
      const parked = roads.parking.filter(current => current !== spot);
      const checkClearance = (dock: WarehouseDockPointValue, stopped: readonly WarehouseDockPointValue[]): void => {
        const x = dock.x + pose.offsetX;
        const z = dock.z + pose.offsetZ;
        const sine = Math.abs(Math.sin(pose.yaw));
        const cosine = Math.abs(Math.cos(pose.yaw));
        const halfWidth = cosine * truckHalfWidth + sine * truckHalfLength;
        const halfLength = cosine * truckHalfLength + sine * truckHalfWidth;
        const collision = stopped.some(current => Math.abs(x - current.x) <= halfWidth + truckHalfWidth
          && Math.abs(z - current.z) <= halfLength + truckHalfLength);
        const truckZ = z + WAREHOUSE_TRUCK_CENTER_Z;
        const leavesApronWhileTurning = sine > 0 && (truckZ - halfLength <= roads.apron.minZ || truckZ + halfLength >= roads.apron.maxZ);
        if (collision || leavesApronWhileTurning || x - halfWidth <= roads.apron.minX || x + halfWidth >= roads.apron.maxX) {
          throw new Error(`Route from (${String(spot.x)}, ${String(spot.z)}) obstructed at (${String(x)}, ${String(z)})`);
        }
      };
      for (let step = 0; step <= samples; step += 1) {
        const { offsetX, offsetZ } = pose;
        readWarehouseParkingArrival(roads, spot, step / samples, pose);
        checkClearance(dockOrigin, parked);
        if (step === 0) {
          expect(pose).toEqual({ offsetX: roads.entrance.x, offsetZ: roads.entrance.z, yaw: 0 });
        }
        else {
          expect(Math.hypot(offsetX - pose.offsetX, offsetZ - pose.offsetZ)).toBeLessThan(1);
        }
      }
      expect(pose).toEqual({ offsetX: spot.x, offsetZ: spot.z, yaw: 0 });

      const aisleStartZ = spot.z + WAREHOUSE_PARKING_EXIT_ADVANCE;
      for (const dock of docks) {
        const stopped = [...parked, ...docks.filter(current => current !== dock)];
        for (let step = 0; step <= samples; step += 1) {
          readWarehouseParkingExit(roads, spot, dock, spot.z + (aisleStartZ - spot.z) * step / samples, pose);
          checkClearance(dock, stopped);
        }
        const aislePose = { ...pose };
        readWarehouseYardApproach(roads, roads.entrance.x, aisleStartZ, dock, 0, pose);
        expect(aislePose).toEqual(pose);
        for (let step = 1; step <= samples; step += 1) {
          const { offsetX, offsetZ } = pose;
          readWarehouseYardApproach(roads, roads.entrance.x, aisleStartZ, dock, step / samples, pose);
          checkClearance(dock, stopped);
          expect(Math.hypot(offsetX - pose.offsetX, offsetZ - pose.offsetZ)).toBeLessThan(1);
        }
        expect(pose.offsetX).toBeCloseTo(0);
        expect(pose.offsetZ).toBeCloseTo(0);
        expect(pose.yaw).toBe(0);
        for (let step = 1; step <= samples; step += 1) {
          const { offsetX, offsetZ } = pose;
          readWarehouseYardApproach(roads, roads.entrance.x, roads.entrance.z, dock, 1 - step / samples, pose);
          checkClearance(dock, stopped);
          expect(Math.hypot(offsetX - pose.offsetX, offsetZ - pose.offsetZ)).toBeLessThan(1);
        }
        expect(pose.offsetZ + dock.z + WAREHOUSE_TRUCK_CENTER_Z + truckHalfLength).toBeLessThan(roads.apron.minZ);
      }
    }
  });

  it.each(scenarios)('clears the parked bodies and the apron on every route for $dockOffsets', ({ dockOffsets, origin }) => {
    const docks = dockOffsets.map(x => ({ x, z: 0 }));
    const roads = buildWarehouseYardRoads(docks.map(dock => ({ x: origin.x + dock.x, z: origin.z + dock.z })));
    if (roads === undefined) {
      throw new Error('Expected yard roads');
    }
    for (const dock of docks) {
      for (const [index, start] of [roads.entrance, ...parking].entries()) {
        const parkIndex = index - 1;
        const usesBypass = parkIndex > 0;
        const pose = { offsetX: 0, offsetZ: 0, yaw: 0 };
        const occupied = [...parking.filter((_position, current) => current !== parkIndex), ...docks.filter(current => current !== dock)];
        const checkClearance = (): void => {
          const x = dock.x + pose.offsetX;
          const z = dock.z + pose.offsetZ;
          const sine = Math.abs(Math.sin(pose.yaw));
          const cosine = Math.abs(Math.cos(pose.yaw));
          const halfWidth = cosine * truckHalfWidth + sine * truckHalfLength;
          const halfLength = cosine * truckHalfLength + sine * truckHalfWidth;
          for (const stopped of occupied) {
            const clears = Math.abs(x - stopped.x) > halfWidth + truckHalfWidth || Math.abs(z - stopped.z) > halfLength + truckHalfLength;
            expect(clears).toBe(true);
          }
          if (sine > 0) {
            expect(x - halfWidth).toBeGreaterThan(roads.apron.minX);
            expect(x + halfWidth).toBeLessThan(roads.apron.maxX);
            expect(z + WAREHOUSE_TRUCK_CENTER_Z - halfLength).toBeGreaterThan(roads.apron.minZ);
            expect(z + WAREHOUSE_TRUCK_CENTER_Z + halfLength).toBeLessThan(roads.apron.maxZ);
          }
        };
        const routeStart: WarehouseDockPointValue = usesBypass
          ? { x: roads.entrance.x, z: start.z + WAREHOUSE_PARKING_EXIT_ADVANCE }
          : start;
        if (usesBypass) {
          for (let step = 0; step <= samples; step += 1) {
            readWarehouseParkingExit(roads, start, dock, start.z + WAREHOUSE_PARKING_EXIT_ADVANCE * step / samples, pose);
            checkClearance();
          }
        }

        readWarehouseYardApproach(roads, routeStart.x, routeStart.z, dock, 0, pose);
        expect(pose.offsetX).toBeCloseTo(routeStart.x - dock.x);
        expect(pose.offsetZ).toBeCloseTo(routeStart.z - dock.z);
        for (let step = 1; step <= samples; step += 1) {
          const { offsetX, offsetZ } = pose;
          readWarehouseYardApproach(roads, routeStart.x, routeStart.z, dock, step / samples, pose);
          checkClearance();
          expect(Math.hypot(offsetX - pose.offsetX, offsetZ - pose.offsetZ)).toBeLessThan(0.7);
        }
        expect(pose.offsetX).toBeCloseTo(0);
        expect(pose.offsetZ).toBeCloseTo(0);
        expect(pose.yaw).toBe(0);
      }
    }
    expect(roads.entrance.z + WAREHOUSE_TRUCK_CENTER_Z + truckHalfLength).toBeLessThan(roads.apron.minZ);
  });
});
