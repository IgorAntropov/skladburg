import { create } from '@bufbuild/protobuf';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  WarehouseCargoUnitValue,
  WarehouseCargoValue,
} from '../model/warehouseSceneCargo';

import { isWarehouseAisleSegmentOpen } from './warehouseAislePath';
import { buildWarehouseCargoTransfers } from './warehouseCargoPositions';
import {
  advanceWarehouseForklift,
  createWarehouseForkliftPlayback,
  queueWarehouseForkliftJobs,
} from './warehouseForkliftPlayback';
import {
  FORKLIFT_CLEARANCE,
  FORKLIFT_FORK_HEIGHT,
} from './warehouseForkliftRoute';
import { getWarehouseLayout } from './warehouseLayout';

const layout = getWarehouseLayout(create(WarehouseTopologySchema, {
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

describe('warehouse forklift jobs', () => {
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
