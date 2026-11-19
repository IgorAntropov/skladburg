import { create } from '@bufbuild/protobuf';
import { StockBalanceSchema } from '@skladburg/contracts/wms/v1/stock';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  WarehouseCargoUnitValue,
  WarehouseCargoValue,
  WarehouseYardVisitValue,
} from '../model/warehouseSceneCargo';
import type { WarehouseCargoVisualValue } from './warehouseCargoPositions';
import type { WarehouseDockStepValue } from './warehouseDockPlayback';

import { isWarehouseAisleSegmentOpen } from './warehouseAislePath';
import {
  buildWarehouseCargoTransfers,
  buildWarehouseCargoVisuals,
  buildWarehouseDepartureCargo,
  groupWarehouseCargoVisuals,
} from './warehouseCargoPositions';
import {
  retainWarehouseDockLoads,
  syncWarehouseDockSteps,
} from './warehouseDockPlayback';
import {
  advanceWarehouseForklift,
  createWarehouseForkliftPlayback,
  MAX_WAREHOUSE_FORKLIFT_JOBS,
  queueWarehouseForkliftJobs,
} from './warehouseForkliftPlayback';
import {
  FORKLIFT_CLEARANCE,
  FORKLIFT_FORK_HEIGHT,
} from './warehouseForkliftRoute';
import { canAdvanceWarehouseForklift } from './warehouseForkliftTraffic';
import { getWarehouseLayout } from './warehouseLayout';

const topology = create(WarehouseTopologySchema, {
  receivingArea: {
    footprint: { depthMm: 3000, origin: { xMm: 1000, zMm: 1000 }, widthMm: 2000 },
    id: 'receiving',
    unloadingPoint: { position: { xMm: 1000, zMm: 0 } },
  },
  storageZones: [{
    rows: [{
      racks: [{
        footprint: { depthMm: 1000, origin: { xMm: 4000, zMm: 1000 }, widthMm: 1800 },
        tiers: [{
          cells: [{ id: 'upper-cell', widthMm: 600 }],
          elevationMm: 1400,
        }],
      }],
    }],
  }],
});

const layout = getWarehouseLayout(topology);
const primary = { x: 1, z: 0 };
const secondary = { x: 7.2, z: 0 };
const wideLayout = getWarehouseLayout(create(WarehouseTopologySchema, {
  receivingArea: {
    additionalUnloadingPoints: [{ id: 'dock-2', position: { xMm: 7200, zMm: 0 } }],
    footprint: { depthMm: 3000, origin: { xMm: 1000, zMm: 1000 }, widthMm: 9000 },
    id: 'receiving',
    unloadingPoint: { position: { xMm: 1000, zMm: 0 } },
  },
  storageZones: topology.storageZones,
}));

const expectedUnit = {
  cellId: undefined, expectedUnitId: 'planned', id: 'planned', location: 'truck', slot: 0, taskId: 'receiving-task', truckSlot: 0,
} satisfies WarehouseCargoUnitValue;

const receivedUnit = { ...expectedUnit, id: 'pallet', location: 'staging' } satisfies WarehouseCargoUnitValue;

const truck = {
  dockTaskId: 'receiving-task',
  hasDock: true,
  units: [expectedUnit],
} satisfies WarehouseCargoValue;

const staging = {
  ...truck,
  units: [receivedUnit],
} satisfies WarehouseCargoValue;

const placed = {
  ...truck,
  units: [{ ...receivedUnit, cellId: 'upper-cell', location: 'cell', slot: 1 }],
} satisfies WarehouseCargoValue;

it('keeps a moving handoff when a batch exceeds the available forklift queue', () => {
  const playback = createWarehouseForkliftPlayback(layout);
  const transfers = buildWarehouseCargoTransfers(layout, truck, staging);
  const [transfer] = transfers;
  expect(transfer).toBeDefined();
  if (transfer === undefined) {
    return;
  }

  queueWarehouseForkliftJobs(playback, layout, transfers);
  advanceWarehouseForklift(playback, 0.02);
  const active = playback.jobs[0];
  const elapsed = playback.elapsed;
  queueWarehouseForkliftJobs(playback, layout, Array.from({ length: 10 }, (_, index) => ({
    ...transfer, id: `batch-${String(index)}`,
  })));

  expect(playback.jobs).toHaveLength(MAX_WAREHOUSE_FORKLIFT_JOBS);
  expect(playback.jobs[0]).toBe(active);
  expect(playback.elapsed).toBe(elapsed);
});

const pickedOutbound = {
  cellId: 'upper-cell',
  expectedUnitId: 'shipment:pallet',
  id: 'pallet',
  isOutbound: true,
  location: 'cell',
  slot: 0,
  taskId: 'dispatch',
  truckSlot: 0,
} satisfies WarehouseCargoUnitValue;

const packedOutbound = { ...pickedOutbound, location: 'truck' } satisfies WarehouseCargoUnitValue;
const picked = { dockTaskId: 'dispatch', dockTripId: 'trip', hasDock: true, units: [pickedOutbound] } satisfies WarehouseCargoValue;
const packed = { ...picked, shippedUnitIds: new Set(['pallet']), units: [packedOutbound] } satisfies WarehouseCargoValue;

describe('warehouse forklift jobs', () => {
  it('plans concurrent unloads using each truck ramp and an independent forklift', () => {
    const secondTask = { ...expectedUnit, expectedUnitId: 'second-pallet', id: 'second-pallet', taskId: 'second-task' };
    const secondTruck = { ...truck, dockTaskId: secondTask.taskId, units: [secondTask] };
    const secondReceipt = { ...secondTruck, units: [{ ...secondTask, location: 'staging', slot: 10 }] } satisfies WarehouseCargoValue;
    const firstJobs = buildWarehouseCargoTransfers(wideLayout, truck, staging);
    const secondJobs = buildWarehouseCargoTransfers(wideLayout, secondTruck, secondReceipt, secondTask.taskId, secondary);
    const firstForklift = createWarehouseForkliftPlayback(wideLayout, primary);
    const secondForklift = createWarehouseForkliftPlayback(wideLayout, secondary);

    queueWarehouseForkliftJobs(firstForklift, wideLayout, firstJobs);
    queueWarehouseForkliftJobs(secondForklift, wideLayout, secondJobs);
    const lanes = [firstForklift, secondForklift];
    expect(canAdvanceWarehouseForklift(lanes, 0)).toBe(true);
    expect(canAdvanceWarehouseForklift(lanes, 1)).toBe(true);
    expect(firstForklift.jobs[0]?.phases.find(phase => phase.load === 'handoff')?.from.x).toBe(primary.x);
    expect(secondForklift.jobs[0]?.phases.find(phase => phase.load === 'handoff')?.from.x).toBe(secondary.x);
    expect(secondJobs[0]?.from.point[0]).toBeCloseTo(secondary.x - 0.36);
    advanceWarehouseForklift(firstForklift, 0.04);
    advanceWarehouseForklift(secondForklift, 0.04);
    expect(firstForklift.elapsed).toBeGreaterThan(0);
    expect(secondForklift.elapsed).toBeGreaterThan(0);
  });

  it('waits for a started local unload and holds a shared route until the forklift returns', () => {
    const first = createWarehouseForkliftPlayback(wideLayout, primary);
    const second = createWarehouseForkliftPlayback(wideLayout, secondary);
    const lanes = [first, second];
    const local = buildWarehouseCargoTransfers(wideLayout, truck, staging, undefined, secondary);
    const firstShared = buildWarehouseCargoTransfers(wideLayout, staging, placed, undefined, primary);
    const secondShared = buildWarehouseCargoTransfers(wideLayout, staging, placed, undefined, secondary);

    queueWarehouseForkliftJobs(second, wideLayout, local);
    expect(canAdvanceWarehouseForklift(lanes, 1)).toBe(true);
    advanceWarehouseForklift(second, 0.04, true);
    queueWarehouseForkliftJobs(first, wideLayout, firstShared);
    queueWarehouseForkliftJobs(second, wideLayout, secondShared);
    expect(first.jobs).toHaveLength(1);
    expect(second.jobs).toHaveLength(2);
    expect(canAdvanceWarehouseForklift(lanes, 0)).toBe(false);
    expect(canAdvanceWarehouseForklift(lanes, 1)).toBe(true);

    for (let frame = 0; frame < 500 && second.jobs.length > 1; frame += 1) {
      advanceWarehouseForklift(second, 0.035, true);
    }
    expect(second.jobs).toHaveLength(1);
    expect(second).toMatchObject({ elapsed: 0, phaseIndex: 0 });
    expect(canAdvanceWarehouseForklift(lanes, 0)).toBe(true);
    expect(canAdvanceWarehouseForklift(lanes, 1)).toBe(false);

    advanceWarehouseForklift(first, 0.04, true);
    expect(canAdvanceWarehouseForklift(lanes, 0)).toBe(true);
    expect(canAdvanceWarehouseForklift(lanes, 1)).toBe(false);
    for (let frame = 0; frame < 500 && first.jobs.length > 0; frame += 1) {
      expect(canAdvanceWarehouseForklift(lanes, 1)).toBe(false);
      advanceWarehouseForklift(first, 0.035, true);
    }
    expect(first.jobs).toHaveLength(0);
    expect(first.pose?.x).toBeCloseTo(primary.x);
    expect(canAdvanceWarehouseForklift(lanes, 1)).toBe(true);

    advanceWarehouseForklift(second, 0.04, true);
    queueWarehouseForkliftJobs(first, wideLayout, firstShared);
    expect(canAdvanceWarehouseForklift(lanes, 0)).toBe(false);
    expect(canAdvanceWarehouseForklift(lanes, 1)).toBe(true);
  });

  it('returns an unloaded forklift to its own dock after shared work while the pallet stays at the destination', () => {
    const playback = createWarehouseForkliftPlayback(wideLayout, secondary);
    const parking = { ...playback.pose };
    const transfers = buildWarehouseCargoTransfers(wideLayout, staging, placed, undefined, secondary);
    queueWarehouseForkliftJobs(playback, wideLayout, transfers);
    const job = playback.jobs[0];
    expect(job).toBeDefined();
    expect(job?.finish).toMatchObject({ lift: 0, reach: 0, x: parking.x, z: parking.z });
    const drop = job?.phases.findIndex(({ load }) => load === 'target') ?? -1;
    const returnPhases = job?.phases.slice(drop) ?? [];
    expect(drop).toBeGreaterThan(0);
    expect(returnPhases[0]?.from.x).not.toBe(parking.x);
    expect(returnPhases.every(({ load }) => load === 'target')).toBe(true);
    const { bounds, obstacles } = wideLayout.navigation;
    for (const { from, to } of returnPhases) {
      expect(isWarehouseAisleSegmentOpen(bounds, obstacles, from, to, FORKLIFT_CLEARANCE)).toBe(true);
    }
  });

  it('collects a confirmed pallet from its upper cell and hands it into the assigned truck', () => {
    const transfers = buildWarehouseCargoTransfers(layout, picked, packed);
    const playback = createWarehouseForkliftPlayback(layout);
    queueWarehouseForkliftJobs(playback, layout, transfers);
    const [job] = playback.jobs;

    expect(transfers).toMatchObject([{ dockTaskId: 'dispatch', from: { location: 'cell' }, id: 'pallet', to: { location: 'truck' } }]);
    expect(job?.transfer.to.size).toEqual(job?.transfer.from.size);
    expect(job?.phases.find(phase => phase.load === 'forks')?.from.lift).toBeCloseTo(1.5595 - FORKLIFT_FORK_HEIGHT);
    const handoff = job?.phases.findIndex(phase => phase.load === 'handoff');
    expect(handoff).toBeGreaterThan(0);
    expect(job?.phases[handoff === undefined ? 0 : handoff + 1]?.load).toBe('target');
    expect(buildWarehouseCargoTransfers(layout, picked, { ...packed, dockTripId: 'different-truck' })).toEqual([]);
    expect(buildWarehouseCargoTransfers(layout, undefined, packed)).toEqual([]);
  });

  it('fills the back of the truck first when one confirmation loads several pallets', () => {
    const units = [0, 1, 2, 3].map((truckSlot): WarehouseCargoUnitValue => ({
      ...pickedOutbound, expectedUnitId: `shipment:${String(truckSlot)}`, id: String(truckSlot), truckSlot,
    }));
    const loaded = units.map((unit): WarehouseCargoUnitValue => ({ ...unit, location: 'truck' }));
    const transfers = buildWarehouseCargoTransfers(layout, { ...picked, units }, { ...packed, units: loaded });

    expect(transfers.map(({ id }) => id)).toEqual(['3', '2', '1', '0']);
  });

  it('keeps local cargo at the dock only during handling and hides the stale cell balance', () => {
    const local = {
      ...packed,
      dockTaskId: undefined,
      dockTripId: undefined,
      yardVisits: new Map([['dispatch', { departure: 'self-pickup', phase: 'departed', taskId: 'dispatch', tripId: undefined }]]),
    } satisfies WarehouseCargoValue;
    const balances = [create(StockBalanceSchema, { cellId: 'upper-cell', handlingUnit: { id: 'pallet' } })];

    expect(buildWarehouseCargoTransfers(layout, { ...picked, dockTripId: undefined }, local, 'dispatch')).toHaveLength(1);
    expect(buildWarehouseCargoTransfers(layout, { ...picked, dockTripId: undefined }, local, 'previous-truck')).toEqual([]);
    const nextDock = {
      ...local,
      dockTaskId: 'next-truck',
      dockTripId: 'next-trip',
    } satisfies WarehouseCargoValue;
    expect(buildWarehouseCargoTransfers(layout, { ...picked, dockTripId: undefined }, nextDock, 'dispatch'))
      .toMatchObject([{ dockTaskId: 'dispatch', from: { location: 'cell' }, to: { location: 'truck' } }]);
    expect(buildWarehouseCargoVisuals(layout, packed, balances, undefined))
      .toMatchObject([{ id: 'pallet', requiresActiveDispatch: false, size: 0.6 * 0.78 }]);
    expect(buildWarehouseCargoVisuals(layout, local, balances, 'dispatch')).toMatchObject([{ id: 'pallet', requiresActiveDispatch: true }]);
    expect(buildWarehouseCargoVisuals(layout, local, balances, undefined)).toEqual([]);
    expect(buildWarehouseCargoVisuals(layout, { ...local, units: [] }, balances, undefined)).toEqual([]);
  });

  it('keeps packing the departing trip ahead of a different truck already assigned to the dock', () => {
    const departure = {
      ...packed,
      dockTaskId: 'next-task',
      dockTripId: 'next-trip',
      units: [],
      yardVisits: new Map([['dispatch', { departure: 'route', phase: 'departed', taskId: 'dispatch', tripId: picked.dockTripId }]]),
    } satisfies WarehouseCargoValue;

    expect(buildWarehouseCargoTransfers(layout, picked, departure, 'dispatch'))
      .toMatchObject([{ dockTaskId: 'dispatch', from: { location: 'cell' }, id: 'pallet', to: { location: 'truck' } }]);
    expect(buildWarehouseCargoTransfers(layout, picked, departure, 'next-task')).toEqual([]);
  });

  it('keeps the confirmed outbound pallet in its truck slot as the truck departs', () => {
    const prev = { ...picked, units: [pickedOutbound, { ...pickedOutbound, id: 'unshipped', truckSlot: 1 }] };
    const [visual] = buildWarehouseCargoVisuals(layout, packed, undefined, undefined);

    expect(visual?.truckTaskId).toBe('dispatch');
    expect(buildWarehouseDepartureCargo(layout, 'dispatch', prev, packed.shippedUnitIds))
      .toMatchObject([{ point: visual?.point, size: visual?.size }]);
    expect(buildWarehouseDepartureCargo(layout, 'wrong-dock', prev, packed.shippedUnitIds)).toEqual([]);
  });

  it('keeps a shipped pallet with its queued truck while a predecessor still occupies the dock', () => {
    const steps: WarehouseDockStepValue[] = [];
    syncWarehouseDockSteps(steps, { ...picked, dockTaskId: 'previous' });
    const previous = { departure: 'received', phase: 'released', taskId: 'previous', tripId: undefined } as const;
    syncWarehouseDockSteps(steps, { ...picked, yardVisits: new Map([['previous', previous]]) });
    syncWarehouseDockSteps(steps, {
      ...packed,
      dockTaskId: 'next',
      yardVisits: new Map<string, WarehouseYardVisitValue>([
        ['dispatch', { departure: 'route', phase: 'departed', taskId: 'dispatch', tripId: packed.dockTripId }],
        ['previous', previous],
      ]),
    });
    retainWarehouseDockLoads(steps, layout, picked, packed.shippedUnitIds, primary);

    expect(steps.map(step => [step.taskId, step.load?.map(item => item.id)])).toEqual([
      ['previous', undefined], ['dispatch', ['pallet']], ['next', undefined],
    ]);
  });

  it('indexes truck pallets by visit separately from the ground layer', () => {
    const visuals = Array.from({ length: 32 }, (_, index): WarehouseCargoVisualValue => ({
      id: `pallet-${String(index)}`, point: [0, 0, 0], size: 0.48,
      stockUnitIds: undefined, truckTaskId: index === 31 ? undefined : `visit-${String(index)}`,
    }));
    const { ground, trucks } = groupWarehouseCargoVisuals(visuals);

    expect(ground).toEqual([visuals[31]]);
    expect(trucks.get('visit-0')).toEqual([visuals[0]]);
    expect(trucks.get('visit-30')).toEqual([visuals[30]]);
  });

  it('preserves the final unload if receipt and dock release arrive together', () => {
    const closed = {
      ...staging,
      dockTaskId: 'next-task',
      dockTripId: 'next-trip',
      yardVisits: new Map([['receiving-task', {
        departure: 'received', phase: 'released', taskId: 'receiving-task', tripId: 'previous-trip',
      }]]),
    } satisfies WarehouseCargoValue;
    const prev = { ...truck, dockTripId: 'previous-trip' };
    expect(buildWarehouseCargoTransfers(layout, prev, closed, 'receiving-task'))
      .toMatchObject([{ dockTaskId: 'receiving-task', from: { location: 'truck' }, to: { location: 'staging' } }]);
    expect(buildWarehouseCargoTransfers(layout, prev, closed, 'previous-truck')).toEqual([]);
  });

  it('uses the actual previous staging slot and ignores historical and other dock cargo', () => {
    const [receipt] = buildWarehouseCargoTransfers(layout, truck, staging);
    const [placement] = buildWarehouseCargoTransfers(layout, staging, placed);

    expect(receipt?.id).toBe('pallet');
    expect(placement?.from).toEqual(receipt?.to);
    expect(buildWarehouseCargoTransfers(layout, undefined, placed)).toEqual([]);
    expect(buildWarehouseCargoTransfers(layout, { ...truck, dockTaskId: 'another-task' }, staging)).toEqual([]);
    expect(buildWarehouseCargoTransfers(layout, truck, { ...staging, dockTaskId: 'another-task' })).toEqual([]);
    expect(buildWarehouseCargoTransfers(layout, { ...truck, units: [{ ...expectedUnit, truckSlot: 12 }] }, staging)).toEqual([]);
    expect(buildWarehouseCargoTransfers(layout, staging, staging)).toEqual([]);
  });

  it('keeps a rear truck pallet from crossing an unreceived pallet at the dock', () => {
    const front = { ...expectedUnit, expectedUnitId: 'front', id: 'front' };
    const rear = { ...expectedUnit, truckSlot: 2 };
    expect(buildWarehouseCargoTransfers(layout, { ...truck, units: [front, rear] }, staging)).toEqual([]);
    expect(buildWarehouseCargoTransfers(layout, { ...truck, units: [rear] }, staging)).toHaveLength(1);
  });

  it('carries successive confirmed legs through clear aisles and reaches the upper cell', () => {
    const transfers = buildWarehouseCargoTransfers(layout, truck, placed);
    const playback = createWarehouseForkliftPlayback(layout);
    for (const transfer of transfers) {
      queueWarehouseForkliftJobs(playback, layout, [transfer]);
      advanceWarehouseForklift(playback, 0.02);
    }
    const [unload, putAway] = playback.jobs;
    const { bounds, obstacles } = layout.navigation;
    expect(transfers.map(({ from, to }) => [from.location, to.location])).toEqual([['truck', 'staging'], ['staging', 'cell']]);
    expect(putAway?.phases[0]?.from).toEqual(unload?.finish);
    expect(unload?.phases.some(({ load }) => load === 'handoff')).toBe(true);
    for (const job of playback.jobs) {
      const drive = job.phases.filter(({ from, to }) => from.x !== to.x || from.z !== to.z);
      expect(drive.some(({ load }) => load === 'forks')).toBe(true);
      for (const { from, to } of drive) {
        expect(isWarehouseAisleSegmentOpen(bounds, obstacles, from, to, FORKLIFT_CLEARANCE)).toBe(true);
      }
    }
    const drop = putAway?.phases.find(({ load }) => load === 'target');
    expect(drop?.from.lift).toBeCloseTo(1.5595 - FORKLIFT_FORK_HEIGHT);
    expect(drop?.from.reach).toBeGreaterThan(0);

    const finish = putAway?.finish;
    for (let frame = 0; frame < 800; frame += 1) {
      advanceWarehouseForklift(playback, 1 / 60);
    }
    expect(playback.jobs).toEqual([]);
    expect(playback.pose).toEqual(finish);
  });

  it('skips playback if the confirmed storage aisle is inaccessible', () => {
    const transfers = buildWarehouseCargoTransfers(layout, staging, placed);
    const blocked = {
      ...layout,
      navigation: {
        ...layout.navigation,
        obstacles: [...layout.navigation.obstacles, { maxX: 3.9, maxZ: 6, minX: 3, minZ: -1 }],
      },
    };
    const playback = createWarehouseForkliftPlayback(blocked);
    const parking = { ...playback.pose };

    expect(transfers).toHaveLength(1);
    queueWarehouseForkliftJobs(playback, blocked, transfers);
    expect(playback.jobs).toEqual([]);
    expect(playback.pose).toEqual(parking);
  });

  it('bounds playback duration for unusually high configured cells', () => {
    const [transfer] = buildWarehouseCargoTransfers(layout, staging, placed);
    expect(transfer).toBeDefined();
    if (transfer === undefined) {
      return;
    }
    const [x, , z] = transfer.to.point;
    const playback = createWarehouseForkliftPlayback(layout);
    queueWarehouseForkliftJobs(playback, layout, [{ ...transfer, to: { ...transfer.to, point: [x, 100, z] } }]);
    expect(playback.jobs).toEqual([]);
  });
});
