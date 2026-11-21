import { create } from '@bufbuild/protobuf';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import { WarehouseEquipmentStatus } from '@skladburg/contracts/wms/v1/warehouse_equipment';
import {
  expect,
  it,
} from 'vitest';

import type { WarehouseSceneEquipmentValue } from '../model/warehouseSceneInteraction';
import type { WarehouseEquipmentActorValue } from './warehouseEquipmentMotion';
import type {
  WarehouseForkliftJobValue,
  WarehouseForkliftPoseValue,
} from './warehouseForkliftRoute';

import {
  advanceWarehouseEquipmentActor,
  placeWarehouseEquipmentBays,
  prepareWarehouseEquipmentRoutes,
  syncWarehouseEquipmentActors,
  syncWarehouseEquipmentCargo,
} from './warehouseEquipmentMotion';
import {
  advanceWarehouseUnassignedCargo,
  createWarehouseForkliftPlayback,
  getWarehouseCargoEndpointWeight,
} from './warehouseForkliftPlayback';
import { getWarehouseLayout } from './warehouseLayout';

const layout = getWarehouseLayout(create(WarehouseTopologySchema, {
  receivingArea: {
    additionalUnloadingPoints: [{ id: 'dock-b', position: { xMm: 7_000, zMm: 0 } }],
    footprint: { depthMm: 4_000, origin: { xMm: 500, zMm: 1_000 }, widthMm: 9_000 },
    id: 'receiving',
    unloadingPoint: { id: 'dock-a', position: { xMm: 3_000, zMm: 0 } },
  },
}));
const building = { depth: 8, width: 12, x: 0, z: 0 };
const bays = placeWarehouseEquipmentBays(layout, building, ['station']);
const unit = (
  id: string, status = WarehouseEquipmentStatus.AVAILABLE, taskId?: string, chargingStationId?: string,
): WarehouseSceneEquipmentValue['units'][number] => ({ badge: id, chargingStationId, id, label: id, status, statusLabel: id, taskId });
const fleet = (...units: WarehouseSceneEquipmentValue['units']): WarehouseSceneEquipmentValue => ({
  stations: [{ equipmentId: units.find(entry => entry.chargingStationId === 'station')?.id, id: 'station', label: 'station' }],
  units,
});
const createJob = (dockTaskId: string, finish: WarehouseForkliftPoseValue): WarehouseForkliftJobValue => ({
  finish,
  phases: [],
  transfer: {
    dockTaskId,
    from: { cellId: undefined, location: 'truck', point: [2, 0.1, 1], size: 0.5 },
    id: dockTaskId,
    taskId: dockTaskId,
    to: { cellId: undefined, location: 'staging', point: [2, 0.1, 2], size: 0.5 },
  },
});

it('places a restored charging unit at its actual station and keeps the other machine at its dock', () => {
  const actors = new Map<string, WarehouseEquipmentActorValue>();
  const first = unit('first', WarehouseEquipmentStatus.CHARGING, undefined, 'station');
  syncWarehouseEquipmentActors(actors, fleet(first, unit('second')), bays, layout);
  expect(bays[0]?.cabinet.x).toBeCloseTo(0.34);
  expect(actors.get('first')?.pose).toEqual(bays[0]?.parking);
  expect(actors.get('second')?.pose).toMatchObject({ x: 7 });
  expect(actors.get('first')?.path).toEqual([]);
});

it('moves on a confirmed transition, keeps progress across charge updates and snaps for reduced motion', () => {
  const actors = new Map<string, WarehouseEquipmentActorValue>();
  syncWarehouseEquipmentActors(actors, fleet(unit('first'), unit('second')), bays, layout);
  const actor = actors.get('first');
  if (actor === undefined) {
    throw new Error('Missing equipment actor');
  }
  const start = { ...actor.pose };
  const charging = unit('first', WarehouseEquipmentStatus.CHARGING, undefined, 'station');
  const waiting = unit('second', WarehouseEquipmentStatus.WAITING_FOR_CHARGE);
  syncWarehouseEquipmentActors(actors, fleet(charging, waiting), bays, layout);
  expect(actor.pose).toEqual(start);
  expect(advanceWarehouseEquipmentActor(actor, 0.04, false)).toBe(true);
  expect(actor.pose).not.toEqual(start);
  expect(actor.pose).not.toEqual(bays[0]?.parking);
  const path = actor.path;
  syncWarehouseEquipmentActors(actors, fleet({ ...charging, badge: '24%' }, waiting), bays, layout);
  expect(actor.path).toBe(path);
  expect(advanceWarehouseEquipmentActor(actor, 0.04, true)).toBe(false);
  expect(actor.pose).toEqual(bays[0]?.parking);
  expect(actors.get('second')?.target).not.toEqual(actor.pose);
  expect(advanceWarehouseEquipmentActor(actor, 30, false)).toBe(false);
  syncWarehouseEquipmentActors(actors, fleet(unit('first'), unit('second')), bays, layout);
  for (let index = 0; index < 200; index += 1) {
    advanceWarehouseEquipmentActor(actor, 0.016, false);
  }
  expect(actor.pose).toEqual(start);
});

it('prefers the confirmed driver after reordered events and replaces an owner across consecutive cargo jobs', () => {
  const actors = new Map<string, WarehouseEquipmentActorValue>();
  const lane = createWarehouseForkliftPlayback(layout);
  if (lane.pose === undefined) {
    throw new Error('Missing dock pose');
  }
  const firstJob = createJob('receipt-a', lane.pose);
  const secondJob = createJob('receipt-b', lane.pose);
  lane.jobs.push(firstJob, secondJob);
  syncWarehouseEquipmentActors(actors, fleet(unit('first'), unit('second')), bays, layout);
  syncWarehouseEquipmentCargo(actors, [lane]);
  expect(actors.get('first')?.cargoLane).toBe(-1);
  expect(lane.equipmentJob).toBeNull();
  syncWarehouseEquipmentActors(actors, fleet(unit('first'), unit('second', WarehouseEquipmentStatus.CARRYING, 'receipt-a')), bays, layout);
  expect(syncWarehouseEquipmentCargo(actors, [lane])).toBe(false);
  expect(actors.get('first')?.cargoLane).toBe(-1);
  expect(actors.get('second')?.cargoLane).toBe(0);
  expect(actors.get('second')?.cargoJob).toBe(firstJob);
  expect(lane.equipmentJob).toBe(firstJob);
  syncWarehouseEquipmentActors(actors, fleet(
    unit('first', WarehouseEquipmentStatus.TO_TASK, 'receipt-b'), unit('second', WarehouseEquipmentStatus.CHARGING, undefined, 'station'),
  ), bays, layout);
  syncWarehouseEquipmentCargo(actors, [lane]);
  expect(actors.get('second')?.cargoLane).toBe(0);
  lane.jobs.shift();
  syncWarehouseEquipmentCargo(actors, [lane]);
  expect(actors.get('first')?.cargoJob).toBe(secondJob);
  const released = actors.get('second');
  if (released === undefined) {
    throw new Error('Missing released actor');
  }
  expect(released.cargoLane).toBe(-1);
  expect(lane.equipmentJob).toBe(secondJob);
  expect(released.needsRoute).toBe(true);
  prepareWarehouseEquipmentRoutes(actors, layout);
  expect(advanceWarehouseEquipmentActor(released, 0, true)).toBe(false);
  expect(released.pose).toEqual(bays[0]?.parking);
});

it('keeps an available forklift parked during a different unassigned receipt on another dock', () => {
  const actors = new Map<string, WarehouseEquipmentActorValue>();
  const assigned = createWarehouseForkliftPlayback(layout);
  const manual = createWarehouseForkliftPlayback(layout);
  if (assigned.pose === undefined || manual.pose === undefined) {
    throw new Error('Missing dock pose');
  }
  const work = createJob('D05-receipt', assigned.pose);
  work.transfer.dockTaskId = undefined;
  assigned.jobs.push(work);
  manual.jobs.push(createJob('D06-receipt', manual.pose));
  syncWarehouseEquipmentActors(actors, fleet(unit('PG-01', WarehouseEquipmentStatus.HANDLING, 'D05-receipt'), unit('PG-02')), bays, layout);
  const parked = { ...actors.get('PG-02')?.pose };
  syncWarehouseEquipmentCargo(actors, [assigned, manual]);
  expect(assigned.equipmentJob).toBe(work);
  expect(manual.equipmentJob).toBeNull();
  expect(actors.get('PG-02')).toMatchObject({ cargoJob: undefined, cargoLane: -1, pose: parked });
});

it('finishes one visible endpoint transition without replaying a late assignment or consuming the next job', () => {
  const actors = new Map<string, WarehouseEquipmentActorValue>();
  const lane = createWarehouseForkliftPlayback(layout);
  if (lane.pose === undefined) {
    throw new Error('Missing dock pose');
  }
  const first = createJob('first', lane.pose);
  const second = createJob('second', lane.pose);
  lane.jobs.push(first, second);
  syncWarehouseEquipmentActors(actors, fleet(unit('truck')), bays, layout);
  syncWarehouseEquipmentCargo(actors, [lane]);
  expect(lane.equipmentJob).toBeNull();
  expect(getWarehouseCargoEndpointWeight(0)).toBe(-1);
  advanceWarehouseUnassignedCargo(lane, 0.1);
  expect(getWarehouseCargoEndpointWeight(lane.elapsed)).toBeGreaterThan(-1);
  syncWarehouseEquipmentActors(actors, fleet(unit('truck', WarehouseEquipmentStatus.HANDLING, 'first')), bays, layout);
  syncWarehouseEquipmentCargo(actors, [lane]);
  expect(lane.equipmentJob).toBeNull();
  expect(lane.unassignedJob).toBe(first);
  for (let frame = 1; frame < 11; frame += 1) {
    advanceWarehouseUnassignedCargo(lane, 0.1);
  }
  expect(getWarehouseCargoEndpointWeight(lane.elapsed)).toBeGreaterThan(0.9);
  advanceWarehouseUnassignedCargo(lane, 0.1);
  expect(lane.jobs).toEqual([second]);
  expect(lane.unassignedJob).toBeUndefined();
  syncWarehouseEquipmentActors(actors, fleet(unit('truck', WarehouseEquipmentStatus.HANDLING, 'second')), bays, layout);
  syncWarehouseEquipmentCargo(actors, [lane]);
  expect(lane.equipmentJob).toBe(second);
});

it('does not invent a link between a visible cargo job and a redacted assignment, charging or repair', () => {
  const actors = new Map<string, WarehouseEquipmentActorValue>();
  const lane = createWarehouseForkliftPlayback(layout);
  if (lane.pose === undefined) {
    throw new Error('Missing dock pose');
  }
  lane.jobs.push(createJob('receipt-hidden', lane.pose));
  syncWarehouseEquipmentActors(actors, fleet(unit('first'), unit('second', WarehouseEquipmentStatus.CARRYING)), bays, layout);
  syncWarehouseEquipmentCargo(actors, [lane]);
  expect([...actors.values()].map(actor => actor.cargoLane)).toEqual([-1, -1]);
  syncWarehouseEquipmentActors(actors, fleet(
    unit('first', WarehouseEquipmentStatus.CHARGING, undefined, 'station'), unit('second', WarehouseEquipmentStatus.IN_REPAIR),
  ), bays, layout);
  syncWarehouseEquipmentCargo(actors, [lane]);
  expect([...actors.values()].map(actor => actor.cargoLane)).toEqual([-1, -1]);
  expect(lane.equipmentJob).toBeNull();
});

it('moves the same distance at twelve and sixty frames per second, and bounds a single long stall', () => {
  const start = (): WarehouseEquipmentActorValue => {
    const actors = new Map<string, WarehouseEquipmentActorValue>();
    syncWarehouseEquipmentActors(actors, fleet(unit('first')), bays, layout);
    const actor = actors.get('first');
    if (actor === undefined) {
      throw new Error('Missing equipment actor');
    }
    const from = { ...actor.pose };
    actor.target = { ...from, x: from.x + 12 };
    actor.path = [from, { ...from, x: from.x + 1.25 }, actor.target];
    actor.step = 1;
    return actor;
  };
  const slow = start();
  const fast = start();
  const initialX = slow.pose.x;
  for (let index = 0; index < 12; index += 1) {
    advanceWarehouseEquipmentActor(slow, 1 / 12, false);
  }
  for (let index = 0; index < 60; index += 1) {
    advanceWarehouseEquipmentActor(fast, 1 / 60, false);
  }
  expect(slow.pose.x).toBeCloseTo(initialX + 3);
  expect(fast.pose.x).toBeCloseTo(slow.pose.x);
  advanceWarehouseEquipmentActor(slow, 0, false);
  expect(slow.pose.x).toBeCloseTo(fast.pose.x);
  advanceWarehouseEquipmentActor(slow, 2, false);
  expect(slow.pose.x - fast.pose.x).toBeCloseTo(0.75);
});

it('catches up from its current position if the confirmed destination changes in transit', () => {
  const actors = new Map<string, WarehouseEquipmentActorValue>();
  syncWarehouseEquipmentActors(actors, fleet(unit('first')), bays, layout);
  const actor = actors.get('first');
  if (actor === undefined) {
    throw new Error('Missing equipment actor');
  }
  const home = { ...actor.pose };
  syncWarehouseEquipmentActors(actors, fleet(unit('first', WarehouseEquipmentStatus.CHARGING, undefined, 'station')), bays, layout);
  advanceWarehouseEquipmentActor(actor, 0.1, false);
  const previous = { ...actor.pose };
  syncWarehouseEquipmentActors(actors, fleet(unit('first')), bays, layout);
  expect(actor.pose).toEqual(previous);
  expect(actor.isCatchingUp).toBe(true);
  expect(advanceWarehouseEquipmentActor(actor, 0.08, false)).toBe(false);
  expect(actor.pose).toEqual(home);
  expect(actor.isCatchingUp).toBe(false);
});
