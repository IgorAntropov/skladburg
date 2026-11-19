import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WarehouseYardLaneValue } from './warehouseYardTraffic';

import {
  createWarehouseDockTruck,
  isWarehouseDockTruckMoving,
} from './warehouseDockTruckMotion';
import { readWarehouseParkingOffset } from './warehouseYardParking';
import { buildWarehouseYardRoads } from './warehouseYardRoads';
import {
  advanceWarehouseYardTraffic,
  createWarehouseYardTraffic,
} from './warehouseYardTraffic';

const visits = ['first', 'second', 'third'].map(taskId => ({ taskId, tripId: undefined }));
const roads = buildWarehouseYardRoads([{ x: 0, z: 0 }, { x: 6.2, z: 0 }]);

const buildLane = (x: number, taskId: string | undefined, target = taskId): WarehouseYardLaneValue => ({
  dock: { x, z: 0 },
  hasChanged: false,
  hasConfirmedDeparture: false,
  target,
  truck: createWarehouseDockTruck(taskId),
});

describe('warehouse yard traffic', () => {
  it('reserves the route from the rear parking place to D06 and runs the other assignment after it', () => {
    const docks = [0, -5, 5, 11, 20, 34];
    const wideRoads = buildWarehouseYardRoads(docks.map(x => ({ x, z: 0 })));
    const traffic = createWarehouseYardTraffic();
    const first = buildLane(0, 'unloading');
    const fifth = buildLane(20, undefined);
    const sixth = buildLane(34, undefined);
    traffic.lanes = [first, ...docks.slice(1, 4).map(x => buildLane(x, undefined)), fifth, sixth];
    traffic.visits = visits;
    advanceWarehouseYardTraffic(traffic, wideRoads, 0, false);
    expect(traffic.yard.parked.map(slot => slot.taskId)).toEqual(['first', 'second', 'third']);

    fifth.target = 'second';
    sixth.target = 'third';
    traffic.visits = visits.slice(0, 1);
    advanceWarehouseYardTraffic(traffic, wideRoads, 0, false);
    expect(traffic.reservation).toBe(fifth);
    const routeStarts: number[] = [];
    let hasStartedSixth = false;
    for (let frame = 0; frame < 240; frame += 1) {
      const current = advanceWarehouseYardTraffic(traffic, wideRoads, 0.05, false);
      expect(traffic.lanes.filter(lane => lane !== undefined && isWarehouseDockTruckMoving(lane.truck)).length).toBeLessThanOrEqual(1);
      if (sixth.truck.phase === 'approaching' && !hasStartedSixth) {
        hasStartedSixth = true;
        routeStarts.push(sixth.truck.start.z);
      }
      if (!current) {
        break;
      }
    }
    expect(routeStarts).toEqual([readWarehouseParkingOffset(2)]);
    expect([fifth.truck, sixth.truck]).toMatchObject([{ phase: 'docked', taskId: 'second' }, { phase: 'docked', taskId: 'third' }]);
    expect(first.truck).toMatchObject({ phase: 'docked', taskId: 'unloading' });

    sixth.hasConfirmedDeparture = true;
    sixth.target = undefined;
    advanceWarehouseYardTraffic(traffic, wideRoads, 0, false);
    expect(traffic.reservation).toBe(sixth);
    for (let frame = 0; frame < 120 && sixth.truck.phase === 'departing'; frame += 1) {
      advanceWarehouseYardTraffic(traffic, wideRoads, 0.05, false);
      expect(first.truck).toMatchObject({ phase: 'docked', taskId: 'unloading' });
    }
    expect(sixth.truck.phase).toBe('away');
    expect(advanceWarehouseYardTraffic(traffic, wideRoads, 0.05, false)).toBe(false);
  });

  it.each([false, true])('switches the yard after departure with reduced motion %s', (isReducedMotion) => {
    const traffic = createWarehouseYardTraffic();
    const lane = buildLane(0, 'departing');
    traffic.lanes[0] = lane;
    traffic.visits = visits;
    advanceWarehouseYardTraffic(traffic, roads, 0, false);
    const parked = traffic.yard.parked[0];
    lane.hasConfirmedDeparture = true;
    lane.target = undefined;
    advanceWarehouseYardTraffic(traffic, roads, 0.05, false);
    expect(lane.truck.phase).toBe('departing');

    lane.target = 'first';
    traffic.visits = visits.slice(1);
    let isMoving = true;
    for (let frame = 0; frame < 240 && isMoving; frame += 1) {
      isMoving = advanceWarehouseYardTraffic(traffic, roads, 0.05, isReducedMotion, true);
      expect(traffic.yard.parked[0]).toBe(parked);
      expect(traffic.yard.parked[0]?.offsetZ).toBe(readWarehouseParkingOffset(0));
    }

    expect(lane.truck).toMatchObject({ phase: 'away', taskId: undefined });
    expect(traffic.reservation).toBeUndefined();
    expect(isMoving).toBe(false);

    const nextRoads = buildWarehouseYardRoads([{ x: 0, z: 0 }, { x: 8, z: 0 }]);
    advanceWarehouseYardTraffic(traffic, nextRoads, 0, isReducedMotion);
    expect(lane.truck).toMatchObject({
      offsetZ: isReducedMotion ? 0 : readWarehouseParkingOffset(0),
      phase: isReducedMotion ? 'docked' : 'approaching',
      taskId: 'first',
    });
  });

  it('keeps both promotions in their parking places until the shared road is free', () => {
    const traffic = createWarehouseYardTraffic();
    const first = buildLane(0, 'd01');
    const second = buildLane(6.2, 'd02');
    traffic.lanes[0] = first;
    traffic.lanes[1] = second;
    traffic.visits = visits;
    advanceWarehouseYardTraffic(traffic, roads, 0, false);
    expect(traffic.yard.parked.map(slot => slot.offsetZ)).toEqual([0, 1, 2].map(readWarehouseParkingOffset));

    first.hasConfirmedDeparture = true;
    second.hasConfirmedDeparture = true;
    first.target = 'second';
    second.target = 'first';
    traffic.visits = visits.slice(2);
    advanceWarehouseYardTraffic(traffic, roads, 0, false);
    expect(first.truck.phase).toBe('departing');
    expect(second.truck.phase).toBe('docked');
    expect(traffic.yard.parked.map(slot => slot.taskId)).toEqual(['first', 'second', 'third']);

    const starts: number[] = [];
    let prior = '';
    let isMoving = true;
    for (let frame = 0; frame < 400 && isMoving; frame += 1) {
      isMoving = advanceWarehouseYardTraffic(traffic, roads, 0.05, false);
      const moving = [first.truck, second.truck].filter(truck => truck.phase === 'approaching' || truck.phase === 'departing');
      expect(moving.length).toBeLessThanOrEqual(1);
      const active = moving[0];
      if (active?.phase === 'approaching' && active.taskId !== prior) {
        starts.push(active.offsetZ);
        prior = active.taskId ?? '';
      }
      if (active !== undefined) {
        expect(traffic.yard.parked.find(slot => slot.taskId === 'third')?.offsetZ).toBe(readWarehouseParkingOffset(2));
      }
    }
    expect(starts).toEqual([readWarehouseParkingOffset(0), readWarehouseParkingOffset(1)]);
    expect(first.truck).toMatchObject({ phase: 'docked', taskId: 'second' });
    expect(second.truck).toMatchObject({ phase: 'docked', taskId: 'first' });
    expect(traffic.yard.parked[0]).toMatchObject({ offsetZ: readWarehouseParkingOffset(0), taskId: 'third' });
    expect(isMoving).toBe(false);
  });

  it('lets an assigned truck leave a rear parking spot while the trucks ahead and behind stay parked', () => {
    const traffic = createWarehouseYardTraffic();
    const lane = buildLane(0, 'd01');
    traffic.lanes[0] = lane;
    traffic.visits = visits;
    advanceWarehouseYardTraffic(traffic, roads, 0, false);
    lane.hasConfirmedDeparture = true;
    lane.target = 'second';
    traffic.visits = visits.filter(visit => visit.taskId !== 'second');

    let hasLeftFromBehind = false;
    let hasUsedBypass = false;
    let isMoving = true;
    for (let frame = 0; frame < 240 && isMoving; frame += 1) {
      isMoving = advanceWarehouseYardTraffic(traffic, roads, 0.05, false);
      const { offsetX, offsetZ, phase, yaw } = lane.truck;
      if (phase === 'approaching') {
        hasLeftFromBehind ||= offsetZ === readWarehouseParkingOffset(1);
        hasUsedBypass ||= offsetX < -2.5;
        const halfWidth = Math.abs(Math.cos(yaw)) * 0.95 + Math.abs(Math.sin(yaw)) * 3.1;
        const halfLength = Math.abs(Math.cos(yaw)) * 3.1 + Math.abs(Math.sin(yaw)) * 0.95;
        for (const parked of traffic.yard.parked) {
          const hasClearance = Math.abs(offsetX) > halfWidth + 0.95 || Math.abs(offsetZ - parked.offsetZ) > halfLength + 3.1;
          expect(hasClearance).toBe(true);
        }
      }
    }
    expect(hasLeftFromBehind).toBe(true);
    expect(hasUsedBypass).toBe(true);
    expect(lane.truck).toMatchObject({ phase: 'docked', taskId: 'second' });
    expect(traffic.yard.parked.map(slot => slot.taskId)).toEqual(['first', 'third']);
    expect(isMoving).toBe(false);
  });

  it('moves a waiting truck from parking when the visual dock target changes without a departure', () => {
    const traffic = createWarehouseYardTraffic();
    const lane = buildLane(0, 'd01');
    traffic.lanes[0] = lane;
    traffic.visits = visits;
    advanceWarehouseYardTraffic(traffic, roads, 0, false);

    lane.target = 'first';
    traffic.visits = [...visits.slice(1), { taskId: 'd01', tripId: undefined }];
    expect(advanceWarehouseYardTraffic(traffic, roads, 0, false)).toBe(true);
    expect(lane.truck).toMatchObject({ offsetZ: readWarehouseParkingOffset(0), phase: 'approaching', taskId: 'first' });
    expect(traffic.yard.parked.map(slot => slot.taskId)).toEqual(['second', 'third', 'd01']);
  });

  it('admits a batch of waiting trucks through the end of the parking lane', () => {
    const traffic = createWarehouseYardTraffic();
    traffic.lanes[0] = buildLane(0, 'd01');
    advanceWarehouseYardTraffic(traffic, roads, 0, false);

    traffic.visits = visits;
    let isMoving = advanceWarehouseYardTraffic(traffic, roads, 0, false);
    expect(traffic.yard.parked.map(slot => slot.taskId)).toEqual(['first']);
    const entranceZ = readWarehouseParkingOffset(3);
    for (let frame = 0; frame < 240 && isMoving; frame += 1) {
      isMoving = advanceWarehouseYardTraffic(traffic, roads, 0.05, false);
      for (const slot of traffic.yard.parked) {
        expect(slot.offsetZ).toBeGreaterThanOrEqual(entranceZ);
      }
    }
    expect(isMoving).toBe(false);
    expect(traffic.yard.parked.map(slot => slot.taskId)).toEqual(['first', 'second', 'third']);
    expect(traffic.yard.parked.map(slot => slot.offsetZ)).toEqual([0, 1, 2].map(readWarehouseParkingOffset));
  });

  it('uses one entrance for two fresh assignments and settles immediately when reduced motion turns on', () => {
    const traffic = createWarehouseYardTraffic();
    const first = buildLane(0, undefined, 'first');
    const second = buildLane(6.2, undefined, 'second');
    traffic.lanes[0] = first;
    traffic.lanes[1] = second;
    expect(advanceWarehouseYardTraffic(traffic, roads, 0, false)).toBe(true);
    expect(first.truck).toMatchObject({ offsetX: roads?.entrance.x, offsetZ: roads?.entrance.z, phase: 'approaching' });
    expect(second.truck.phase).toBe('away');
    expect(advanceWarehouseYardTraffic(traffic, roads, 0.05, true)).toBe(false);
    expect(first.truck).toMatchObject({ offsetX: 0, offsetZ: 0, phase: 'docked', taskId: 'first', yaw: 0 });
    expect(second.truck).toMatchObject({ offsetX: 0, offsetZ: 0, phase: 'docked', taskId: 'second', yaw: 0 });
  });
});
