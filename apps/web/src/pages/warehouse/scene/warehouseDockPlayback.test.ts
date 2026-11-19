import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WarehouseCargoValue } from '../model/warehouseSceneCargo';
import type { WarehouseDockStepValue } from './warehouseDockPlayback';
import type { WarehouseYardLaneValue } from './warehouseYardTraffic';

import {
  advanceWarehouseDockSteps,
  hasPendingWarehouseDockStep,
  syncWarehouseDockSteps,
} from './warehouseDockPlayback';
import { createWarehouseDockTruck } from './warehouseDockTruckMotion';
import { buildWarehouseYardRoads } from './warehouseYardRoads';
import {
  advanceWarehouseYardTraffic,
  createWarehouseYardTraffic,
  setWarehouseYardLane,
  setWarehouseYardVisits,
} from './warehouseYardTraffic';

const assigned = (dockTaskId: string | undefined): WarehouseCargoValue => ({ dockTaskId, hasDock: true, units: [] });

const released = (dockTaskId: string | undefined): WarehouseCargoValue => ({
  ...assigned(dockTaskId),
  yardVisits: new Map([['first', { departure: 'received', phase: 'released', taskId: 'first', tripId: undefined }]]),
});

describe('warehouse dock playback', () => {
  it('retains the already confirmed approach and waits for handoff before the exit', () => {
    const steps: WarehouseDockStepValue[] = [];
    syncWarehouseDockSteps(steps, assigned('first'));
    syncWarehouseDockSteps(steps, released('next'));
    syncWarehouseDockSteps(steps, released('next'));

    expect(steps.map(step => step.taskId)).toEqual(['first', 'next']);
    expect(advanceWarehouseDockSteps(steps, 'away', undefined, false)).toBe('first');
    expect(advanceWarehouseDockSteps(steps, 'approaching', 'first', true)).toBe('first');
    expect(advanceWarehouseDockSteps(steps, 'docked', 'first', true)).toBe('first');
    expect(steps[0]?.isCatchingUp).toBe(true);
    expect(advanceWarehouseDockSteps(steps, 'docked', 'first', false)).toBeUndefined();
    expect(advanceWarehouseDockSteps(steps, 'departing', 'first', false)).toBeUndefined();
    expect(advanceWarehouseDockSteps(steps, 'away', undefined, false)).toBe('next');
    syncWarehouseDockSteps(steps, released('next'));
    expect(steps.map(step => step.taskId)).toEqual(['next']);
  });

  it('starts a reopened dock from the current assignment even with old terminal facts', () => {
    const steps: WarehouseDockStepValue[] = [];
    syncWarehouseDockSteps(steps, released('next'));

    expect(advanceWarehouseDockSteps(steps, 'docked', 'next', false)).toBe('next');
    expect(steps.map(step => step.taskId)).toEqual(['next']);
  });

  it('drops an unconfirmed replacement without queuing an exit', () => {
    const steps: WarehouseDockStepValue[] = [];
    syncWarehouseDockSteps(steps, assigned('first'));
    syncWarehouseDockSteps(steps, assigned('next'));

    expect(steps.map(step => step.taskId)).toEqual(['next']);
  });

  it('retains the handoff target of a released successor while the previous truck leaves', () => {
    const steps: WarehouseDockStepValue[] = [];
    syncWarehouseDockSteps(steps, assigned('first'));
    advanceWarehouseDockSteps(steps, 'docked', 'first', false);
    const second = released('second');
    syncWarehouseDockSteps(steps, second);
    advanceWarehouseDockSteps(steps, 'departing', 'first', false);
    syncWarehouseDockSteps(steps, {
      ...released('third'),
      yardVisits: new Map([...second.yardVisits ?? [], [
        'second', { departure: 'received', phase: 'released', taskId: 'second', tripId: undefined },
      ]]),
    });

    expect(hasPendingWarehouseDockStep(steps, 'first')).toBe(false);
    expect(hasPendingWarehouseDockStep(steps, 'second')).toBe(true);
    expect(advanceWarehouseDockSteps(steps, 'away', undefined, false)).toBe('second');
  });

  it('runs a newly released parked visit through its actual reserved approach and exit in one to two seconds', () => {
    const traffic = createWarehouseYardTraffic();
    const dock = { x: 0, z: 0 };
    const roads = buildWarehouseYardRoads([dock], 30);
    const lane: WarehouseYardLaneValue = {
      dock, hasChanged: false, hasConfirmedDeparture: false, target: undefined, truck: createWarehouseDockTruck(undefined),
    };
    setWarehouseYardLane(traffic, 0, lane);
    const parked = Array.from({ length: 30 }, (_, index) => ({
      taskId: index === 29 ? 'first' : `neighbor-${String(index)}`, tripId: undefined,
    }));
    setWarehouseYardVisits(traffic, parked);
    advanceWarehouseYardTraffic(traffic, roads, 0, false);
    const steps: WarehouseDockStepValue[] = [];
    syncWarehouseDockSteps(steps, assigned('first'));
    syncWarehouseDockSteps(steps, released(undefined));
    setWarehouseYardVisits(traffic, parked.slice(0, -1));

    const delta = 1 / 60;
    let elapsed = 0;
    const phases = new Set<string>();
    while (steps.length > 0 && elapsed < 4) {
      lane.target = advanceWarehouseDockSteps(steps, lane.truck.phase, lane.truck.taskId, false);
      lane.hasConfirmedDeparture = steps[0]?.departure !== undefined;
      lane.isCatchingUp = steps[0]?.isCatchingUp;
      advanceWarehouseYardTraffic(traffic, roads, delta, false);
      phases.add(lane.truck.phase);
      elapsed += delta;
    }

    expect([...phases]).toEqual(['approaching', 'docked', 'departing', 'away']);
    expect(elapsed).toBeGreaterThanOrEqual(1);
    expect(elapsed).toBeLessThanOrEqual(2);
    expect(traffic.reservation).toBeUndefined();
  });
});
