import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WarehouseYardLaneValue } from './warehouseYardTraffic';

import { createWarehouseDockTruck } from './warehouseDockTruckMotion';
import { readWarehouseParkingOffset } from './warehouseYardParking';
import { buildWarehouseYardRoads } from './warehouseYardRoads';
import {
  advanceWarehouseYardTraffic,
  createWarehouseYardTraffic,
} from './warehouseYardTraffic';

const visits = ['first', 'second', 'third'].map(taskId => ({ taskId, tripId: undefined }));
const docks = [{ x: 0, z: 0 }, { x: 6.2, z: 0 }];

const buildLane = (x: number, taskId: string | undefined, target = taskId): WarehouseYardLaneValue => ({
  dock: { x, z: 0 },
  hasChanged: false,
  hasConfirmedDeparture: false,
  target,
  truck: createWarehouseDockTruck(taskId),
});

describe('warehouse yard traffic', () => {
  it('keeps both promotions in their parking places until the shared road is free', () => {
    const traffic = createWarehouseYardTraffic(buildWarehouseYardRoads(docks));
    const first = buildLane(0, 'd01');
    const second = buildLane(6.2, 'd02');
    traffic.lanes[0] = first;
    traffic.lanes[1] = second;
    traffic.visits = visits;
    advanceWarehouseYardTraffic(traffic, 0, false);
    expect(traffic.yard.parked.map(slot => slot.offsetZ)).toEqual([0, 1, 2].map(readWarehouseParkingOffset));

    first.hasConfirmedDeparture = true;
    second.hasConfirmedDeparture = true;
    first.target = 'second';
    second.target = 'first';
    traffic.visits = visits.slice(2);
    advanceWarehouseYardTraffic(traffic, 0, false);
    expect(first.truck.phase).toBe('departing');
    expect(second.truck.phase).toBe('docked');
    expect(traffic.yard.parked.map(slot => slot.taskId)).toEqual(['first', 'second', 'third']);

    const starts: number[] = [];
    let prior = '';
    let isMoving = true;
    for (let frame = 0; frame < 400 && isMoving; frame += 1) {
      isMoving = advanceWarehouseYardTraffic(traffic, 0.05, false);
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
    const traffic = createWarehouseYardTraffic(buildWarehouseYardRoads(docks));
    const lane = buildLane(0, 'd01');
    traffic.lanes[0] = lane;
    traffic.visits = visits;
    advanceWarehouseYardTraffic(traffic, 0, false);
    lane.hasConfirmedDeparture = true;
    lane.target = 'second';
    traffic.visits = visits.filter(visit => visit.taskId !== 'second');

    let hasLeftFromBehind = false;
    let hasUsedBypass = false;
    let isMoving = true;
    for (let frame = 0; frame < 240 && isMoving; frame += 1) {
      isMoving = advanceWarehouseYardTraffic(traffic, 0.05, false);
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
    const traffic = createWarehouseYardTraffic(buildWarehouseYardRoads(docks));
    const lane = buildLane(0, 'd01');
    traffic.lanes[0] = lane;
    traffic.visits = visits;
    advanceWarehouseYardTraffic(traffic, 0, false);

    lane.target = 'first';
    traffic.visits = [...visits.slice(1), { taskId: 'd01', tripId: undefined }];
    expect(advanceWarehouseYardTraffic(traffic, 0, false)).toBe(true);
    expect(lane.truck).toMatchObject({ offsetZ: readWarehouseParkingOffset(0), phase: 'approaching', taskId: 'first' });
    expect(traffic.yard.parked.map(slot => slot.taskId)).toEqual(['second', 'third', 'd01']);
  });

  it('admits a batch of waiting trucks through the end of the parking lane', () => {
    const traffic = createWarehouseYardTraffic(buildWarehouseYardRoads(docks));
    traffic.lanes[0] = buildLane(0, 'd01');
    advanceWarehouseYardTraffic(traffic, 0, false);

    traffic.visits = visits;
    let isMoving = advanceWarehouseYardTraffic(traffic, 0, false);
    expect(traffic.yard.parked.map(slot => slot.taskId)).toEqual(['first']);
    const entranceZ = readWarehouseParkingOffset(3);
    for (let frame = 0; frame < 240 && isMoving; frame += 1) {
      isMoving = advanceWarehouseYardTraffic(traffic, 0.05, false);
      for (const slot of traffic.yard.parked) {
        expect(slot.offsetZ).toBeGreaterThanOrEqual(entranceZ);
      }
    }
    expect(isMoving).toBe(false);
    expect(traffic.yard.parked.map(slot => slot.taskId)).toEqual(['first', 'second', 'third']);
    expect(traffic.yard.parked.map(slot => slot.offsetZ)).toEqual([0, 1, 2].map(readWarehouseParkingOffset));
  });

  it('uses one entrance for two fresh assignments and settles immediately when reduced motion turns on', () => {
    const roads = buildWarehouseYardRoads(docks);
    const traffic = createWarehouseYardTraffic(roads);
    const first = buildLane(0, undefined, 'first');
    const second = buildLane(6.2, undefined, 'second');
    traffic.lanes[0] = first;
    traffic.lanes[1] = second;
    expect(advanceWarehouseYardTraffic(traffic, 0, false)).toBe(true);
    expect(first.truck).toMatchObject({ offsetX: roads?.entrance.x, offsetZ: roads?.entrance.z, phase: 'approaching' });
    expect(second.truck.phase).toBe('away');
    expect(advanceWarehouseYardTraffic(traffic, 0.05, true)).toBe(false);
    expect(first.truck).toMatchObject({ offsetX: 0, offsetZ: 0, phase: 'docked', taskId: 'first', yaw: 0 });
    expect(second.truck).toMatchObject({ offsetX: 0, offsetZ: 0, phase: 'docked', taskId: 'second', yaw: 0 });
  });
});
