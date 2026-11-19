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

const expandedVisits = (count: number): typeof visits => Array.from({ length: count }, (_unused, index) => ({
  taskId: `visit-${String(index + 1)}`,
  tripId: undefined,
}));

const buildExpandedRoads = (count: number): NonNullable<ReturnType<typeof buildWarehouseYardRoads>> => {
  const plan = buildWarehouseYardRoads([{ x: 0, z: 0 }, { x: 6.2, z: 0 }], count);
  if (plan === undefined) {
    throw new Error('Expected yard roads');
  }
  return plan;
};

const readParked = (traffic: ReturnType<typeof createWarehouseYardTraffic>): { offsetX: number; offsetZ: number; taskId: string }[] =>
  traffic.yard.parked.map(({ offsetX, offsetZ, taskId }) => ({ offsetX, offsetZ, taskId }));

describe('warehouse yard traffic', () => {
  it.each([3, 6])('keeps the assigned successor in its parking place during the previous exit with %i places', (capacity) => {
    const traffic = createWarehouseYardTraffic();
    const lane = buildLane(6.2, 'occupant');
    const plan = buildExpandedRoads(capacity);
    traffic.lanes = [buildLane(0, 'neighbor'), lane];
    traffic.visits = visits;
    advanceWarehouseYardTraffic(traffic, plan, 0, false);
    const original = readParked(traffic).find(({ taskId }) => taskId === 'third');

    traffic.visits = visits.slice(0, -1);
    lane.dockSteps = [{
      departure: undefined, hasReachedDock: false, hasStartedExit: false, isCatchingUp: false, taskId: 'third', tripId: undefined,
    }];
    lane.hasConfirmedDeparture = true;
    lane.target = undefined;
    advanceWarehouseYardTraffic(traffic, plan, 1 / 60, false);

    expect(lane.truck.phase).toBe('departing');
    expect(readParked(traffic).find(({ taskId }) => taskId === 'third')).toEqual(original);
  });

  it.each([30, 60, 120])('catches up a confirmed approach and departure from rear parking within two seconds at %i Hz', (rate) => {
    const traffic = createWarehouseYardTraffic();
    const lane = buildLane(6.2, undefined);
    const plan = buildExpandedRoads(30);
    const delta = 1 / rate;
    const taskId = 'visit-28';
    traffic.lanes = [buildLane(0, 'unloading'), lane];
    traffic.visits = expandedVisits(28);
    advanceWarehouseYardTraffic(traffic, plan, 0, false);
    const assignedPosition = readParked(traffic).find(visit => visit.taskId === taskId);

    lane.target = taskId;
    lane.isCatchingUp = true;
    traffic.visits = traffic.visits.filter(visit => visit.taskId !== taskId);
    expect(advanceWarehouseYardTraffic(traffic, plan, 0, false)).toBe(true);
    expect(traffic.reservation).toBe(lane);
    expect(lane.truck.start).toEqual({ x: assignedPosition?.offsetX, z: assignedPosition?.offsetZ });

    let elapsed = 0;
    const phases: (typeof lane.truck.phase)[] = ['approaching'];
    for (let frame = 0; frame < 600 && traffic.reservation !== undefined; frame += 1) {
      advanceWarehouseYardTraffic(traffic, plan, delta, false);
      elapsed += delta;
      if (phases.at(-1) !== lane.truck.phase) {
        phases.push(lane.truck.phase);
      }
      if (lane.truck.phase === 'docked') {
        lane.hasConfirmedDeparture = true;
        lane.target = undefined;
        expect(advanceWarehouseYardTraffic(traffic, plan, 0, false)).toBe(true);
        expect(traffic.reservation).toBe(lane);
        phases.push(lane.truck.phase);
      }
      expect(traffic.yard.byTask.has(taskId)).toBe(false);
    }
    expect(phases).toEqual(['approaching', 'docked', 'departing', 'away']);
    expect(elapsed).toBeGreaterThanOrEqual(1);
    expect(elapsed).toBeLessThanOrEqual(2);
    expect(advanceWarehouseYardTraffic(traffic, plan, delta, false)).toBe(false);
  });

  it('keeps a catch-up approach waiting behind a normal departure without speeding up its reservation', () => {
    const traffic = createWarehouseYardTraffic();
    const departing = buildLane(0, 'unloading');
    const waiting = buildLane(6.2, undefined);
    const plan = buildExpandedRoads(25);
    const delta = 1 / 60;
    traffic.lanes = [departing, waiting];
    traffic.visits = expandedVisits(24);
    advanceWarehouseYardTraffic(traffic, plan, 0, false);
    const assignedPosition = readParked(traffic).at(-1);

    departing.hasConfirmedDeparture = true;
    departing.target = undefined;
    waiting.target = assignedPosition?.taskId;
    waiting.isCatchingUp = true;
    advanceWarehouseYardTraffic(traffic, plan, 0, false);

    let beforeRelease = 0;
    for (let frame = 0; frame < 240 && traffic.reservation === departing; frame += 1) {
      expect(waiting.truck.phase).toBe('away');
      expect(readParked(traffic).at(-1)).toEqual(assignedPosition);
      advanceWarehouseYardTraffic(traffic, plan, delta, false);
      beforeRelease += delta;
    }
    expect(beforeRelease).toBeCloseTo(2.8, 1);
    expect(traffic.reservation).toBe(waiting);
    let afterRelease = 0;
    for (let frame = 0; frame < 120 && traffic.reservation === waiting; frame += 1) {
      advanceWarehouseYardTraffic(traffic, plan, delta, false);
      afterRelease += delta;
    }
    expect(afterRelease).toBeLessThanOrEqual(2);
    expect(waiting.truck).toMatchObject({ phase: 'docked', taskId: assignedPosition?.taskId });
    expect(advanceWarehouseYardTraffic(traffic, plan, delta, false)).toBe(false);
  });

  it('continues the existing parking reservation at catch-up speed without applying the hidden time', () => {
    const traffic = createWarehouseYardTraffic();
    const plan = buildExpandedRoads(12);
    traffic.lanes = [buildLane(0, undefined)];
    traffic.visits = expandedVisits(10);
    advanceWarehouseYardTraffic(traffic, plan, 0, false);
    traffic.visits = expandedVisits(11);
    advanceWarehouseYardTraffic(traffic, plan, 0, false);
    const arrival = traffic.reservation;
    advanceWarehouseYardTraffic(traffic, plan, 0.05, false);
    const before = traffic.yard.elapsed;

    advanceWarehouseYardTraffic(traffic, plan, 100, false, false, true);
    expect(traffic.reservation).toBe(arrival);
    expect(traffic.yard.elapsed - before).toBeLessThanOrEqual(0.2);
    expect(traffic.yard.elapsed).toBeGreaterThan(before + 0.05);

    const delta = 1 / 60;
    let elapsed = 0;
    for (let frame = 0; frame < 120 && traffic.reservation === arrival; frame += 1) {
      advanceWarehouseYardTraffic(traffic, plan, delta, false, false, true);
      elapsed += delta;
    }
    expect(elapsed).toBeLessThanOrEqual(2);
    expect(traffic.reservation).toBeUndefined();
    expect(advanceWarehouseYardTraffic(traffic, plan, delta, false)).toBe(false);
  });

  it.each([20, 25, 30])('preserves distinct places for %i simultaneous visits through repeated and reordered snapshots', (count) => {
    const traffic = createWarehouseYardTraffic();
    traffic.lanes = [buildLane(0, 'dock-first'), buildLane(6.2, 'dock-second')];
    const snapshot = expandedVisits(count - 2);
    const plan = buildExpandedRoads(count - 2);
    traffic.visits = [...snapshot, ...snapshot];

    expect(advanceWarehouseYardTraffic(traffic, plan, 0, false)).toBe(false);
    const initial = readParked(traffic);
    expect(initial).toHaveLength(count - 2);
    expect(new Set(initial.map(({ offsetX, offsetZ }) => `${String(offsetX)}:${String(offsetZ)}`)).size).toBe(count - 2);

    traffic.visits = snapshot.toReversed();
    expect(advanceWarehouseYardTraffic(traffic, plan, 0, false)).toBe(false);
    expect(readParked(traffic)).toEqual(initial);
    expect(traffic.hasParkingChanged).toBe(false);
  });

  it('keeps the next arrival outside until a place is free and brings it to that exact place', () => {
    const traffic = createWarehouseYardTraffic();
    traffic.lanes = [buildLane(0, 'dock')];
    const snapshot = expandedVisits(31);
    const plan = buildExpandedRoads(30);
    traffic.visits = snapshot;
    expect(advanceWarehouseYardTraffic(traffic, plan, 0, false)).toBe(false);
    expect(traffic.yard.parked).toHaveLength(30);
    const freed = traffic.yard.parked[5];
    expect(freed?.taskId).toBe('visit-6');
    const original = readParked(traffic).filter(({ taskId }) => taskId !== 'visit-6');
    const freedPose = { offsetX: freed?.offsetX, offsetZ: freed?.offsetZ };
    expect(traffic.yard.parked.some(({ taskId }) => taskId === 'visit-31')).toBe(false);

    traffic.visits = snapshot.filter(({ taskId }) => taskId !== 'visit-6');
    expect(advanceWarehouseYardTraffic(traffic, plan, 0, false)).toBe(true);
    expect(traffic.reservation).toMatchObject({ taskId: 'visit-31' });
    expect(traffic.yard.parked.find(({ taskId }) => taskId === 'visit-31')).toMatchObject({
      offsetX: plan.entrance.x,
      offsetZ: plan.entrance.z,
    });
    for (let frame = 0; frame < 240 && traffic.reservation !== undefined; frame += 1) {
      advanceWarehouseYardTraffic(traffic, plan, 0.05, false);
    }
    expect(traffic.reservation).toBeUndefined();
    expect(traffic.yard.parked.find(({ taskId }) => taskId === 'visit-31')).toMatchObject(freedPose);
    expect(readParked(traffic).filter(({ taskId }) => taskId !== 'visit-31')).toEqual(original);
  });

  it('keeps the compact places when the fourth truck gets the expanded entry reservation', () => {
    const traffic = createWarehouseYardTraffic();
    const docked = buildLane(0, 'dock');
    const nextLane = buildLane(6.2, undefined);
    traffic.lanes = [docked, nextLane];
    traffic.visits = visits;
    advanceWarehouseYardTraffic(traffic, roads, 0, false);
    const initial = readParked(traffic);
    const plan = buildExpandedRoads(4);
    const newVisit = { taskId: 'fourth', tripId: undefined };
    traffic.visits = [...visits, newVisit, newVisit];

    expect(advanceWarehouseYardTraffic(traffic, plan, 0, false)).toBe(true);
    expect(readParked(traffic).slice(0, 3)).toEqual(initial);
    expect(traffic.reservation).toMatchObject({ taskId: 'fourth' });
    nextLane.target = 'fourth';
    traffic.visits = visits;
    expect(advanceWarehouseYardTraffic(traffic, plan, 0.05, false)).toBe(true);
    expect(traffic.reservation).toMatchObject({ taskId: 'fourth' });
    expect(nextLane.truck.phase).toBe('away');

    let isMoving = true;
    let didPromote = false;
    for (let frame = 0; frame < 240 && isMoving; frame += 1) {
      isMoving = advanceWarehouseYardTraffic(traffic, plan, 0.05, false);
      if (nextLane.truck.taskId === 'fourth') {
        didPromote = true;
        expect(traffic.yard.parked.some(({ taskId }) => taskId === 'fourth')).toBe(false);
      }
      expect(readParked(traffic).slice(0, 3)).toEqual(initial);
    }
    expect(didPromote).toBe(true);
    expect(nextLane.truck).toMatchObject({ phase: 'docked', taskId: 'fourth' });
    expect(isMoving).toBe(false);
  });

  it('keeps one visible truck if repeated snapshots assign the same visit to two lanes', () => {
    const traffic = createWarehouseYardTraffic();
    const first = buildLane(0, 'duplicate');
    const second = buildLane(6.2, 'duplicate');
    traffic.lanes = [first, second];
    traffic.visits = [{ taskId: 'duplicate', tripId: undefined }, ...visits];
    const plan = buildExpandedRoads(6);

    expect(advanceWarehouseYardTraffic(traffic, plan, 0, false)).toBe(false);
    expect(first.truck).toMatchObject({ phase: 'docked', taskId: 'duplicate' });
    expect(second.truck).toMatchObject({ phase: 'away', taskId: undefined });
    expect(traffic.yard.parked.some(({ taskId }) => taskId === 'duplicate')).toBe(false);
    expect(advanceWarehouseYardTraffic(traffic, plan, 0, false)).toBe(false);
  });

  it('finishes the active entrance before changing the roads or departing from the dock', () => {
    const traffic = createWarehouseYardTraffic();
    const docked = buildLane(0, 'dock');
    const nextLane = buildLane(6.2, undefined);
    traffic.lanes = [docked, nextLane];
    const plan = buildExpandedRoads(12);
    traffic.visits = expandedVisits(10);
    advanceWarehouseYardTraffic(traffic, plan, 0, false);
    const oldParking = readParked(traffic);
    traffic.visits = expandedVisits(11);
    advanceWarehouseYardTraffic(traffic, plan, 0, false);
    const arrival = traffic.reservation;
    expect(arrival).toMatchObject({ taskId: 'visit-11' });

    docked.hasConfirmedDeparture = true;
    docked.target = undefined;
    nextLane.target = 'visit-11';
    traffic.visits = expandedVisits(10);
    let isMoving = true;
    for (let frame = 0; frame < 120 && isMoving; frame += 1) {
      isMoving = advanceWarehouseYardTraffic(traffic, plan, 0.05, false, true);
      expect(traffic.reservation === arrival || traffic.reservation === undefined).toBe(true);
      expect(docked.truck.phase).toBe('docked');
      expect(nextLane.truck.phase).toBe('away');
      expect(readParked(traffic).slice(0, 10)).toEqual(oldParking);
    }
    expect(isMoving).toBe(false);

    const nextPlan = buildExpandedRoads(24);
    expect(advanceWarehouseYardTraffic(traffic, nextPlan, 0, false)).toBe(true);
    expect(traffic.reservation).toBe(docked);
    expect(nextLane.truck.phase).toBe('away');
    const assignedPosition = readParked(traffic).find(({ taskId }) => taskId === 'visit-11');
    for (let frame = 0; frame < 120 && traffic.reservation === docked; frame += 1) {
      advanceWarehouseYardTraffic(traffic, nextPlan, 0.05, false);
      if (traffic.reservation === docked) {
        expect(readParked(traffic).find(({ taskId }) => taskId === 'visit-11')).toEqual(assignedPosition);
      }
    }
    expect(traffic.reservation).toBe(nextLane);
    expect(nextLane.truck.start).toEqual({ x: assignedPosition?.offsetX, z: assignedPosition?.offsetZ });
    expect(readParked(traffic)).toEqual(oldParking);
  });

  it('settles assigned, entering and waiting visits without duplicate trucks in reduced motion', () => {
    const traffic = createWarehouseYardTraffic();
    const lane = buildLane(0, undefined, 'initial-dock');
    traffic.lanes = [lane];
    const plan = buildExpandedRoads(8);
    traffic.visits = expandedVisits(4);
    expect(advanceWarehouseYardTraffic(traffic, plan, 0, false)).toBe(false);
    expect(lane.truck).toMatchObject({ phase: 'docked', taskId: 'initial-dock' });
    const parked = readParked(traffic);

    traffic.visits = expandedVisits(7);
    advanceWarehouseYardTraffic(traffic, plan, 0, false);
    expect(traffic.reservation).toMatchObject({ taskId: 'visit-5' });
    lane.target = 'visit-5';
    lane.hasConfirmedDeparture = true;

    expect(advanceWarehouseYardTraffic(traffic, plan, 0.05, true)).toBe(false);
    expect(traffic.reservation).toBeUndefined();
    expect(lane.truck).toMatchObject({ phase: 'docked', taskId: 'visit-5' });
    expect(readParked(traffic).slice(0, 4)).toEqual(parked);
    expect(traffic.yard.parked.map(({ taskId }) => taskId)).toEqual([
      'visit-1', 'visit-2', 'visit-3', 'visit-4', 'visit-6', 'visit-7',
    ]);
  });

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
