import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  ReceivingTaskSchema,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  expect,
  it,
} from 'vitest';

import type {
  InboundDockAllocationValue,
  InboundDockCandidateValue,
} from './inboundDockSchedule';

import { INBOUND_DOCK_SLOT_DURATION_MS } from './inboundDockSlots';
import { allocateInboundQueue } from './inboundQueueAllocation';
import {
  DEFAULT_YARD_QUEUE_WEIGHTS,
  rankYardQueue,
} from './yardQueueScoring';

const worldTimeMs = 60_000;
const day = { day: 19, month: 11, year: 2026 };

const candidate = (id: string, isScheduled: boolean, isUrgent: boolean, hasColdCargo = false): InboundDockCandidateValue => ({
  arrivedAtMs: worldTimeMs,
  deliveryEndsAtMs: undefined,
  documentsReadyAt: undefined,
  earliestUsableExpiry: undefined,
  hasAvailableResources: undefined,
  hasColdCargo,
  hasOversizeCargo: false,
  hasReceipt: false,
  id,
  isUrgent,
  task: create(ReceivingTaskSchema, {
    dockSchedule: isScheduled ? { preferredStartsAt: timestampFromMs(worldTimeMs) } : undefined,
    id,
    yardAdmissionStatus: YardAdmissionStatus.WAITING_DOCK,
  }),
});

const allocation = (): InboundDockAllocationValue => ({ changed: new Set(), occupied: new Map(), reservations: new Map(), worldTimeMs });

const dock = { canHandleOversize: false, hasColdZone: true, id: 'D01' };

it.each([true, false])('gives the free dock to the higher-ranked visit across scheduling modes (%s)', (isUrgentScheduled) => {
  const urgent = candidate('urgent', isUrgentScheduled, true);
  const normal = candidate('normal', !isUrgentScheduled, false);
  const state = allocation();
  allocateInboundQueue(rankYardQueue([normal, urgent], DEFAULT_YARD_QUEUE_WEIGHTS, worldTimeMs, day), [dock], state);
  expect(urgent.task.unloadingPointId).toBe(dock.id);
  expect(normal.task.unloadingPointId).toBeUndefined();
});

it('keeps a booked visit ahead of an unreserved urgent visit at the same dock', () => {
  const booked = candidate('booked', true, false);
  const urgent = candidate('urgent', true, true);
  const slot = { dockId: dock.id, endsAtMs: worldTimeMs + INBOUND_DOCK_SLOT_DURATION_MS, startsAtMs: worldTimeMs };
  const state = allocation();
  state.reservations.set(booked.task, slot);
  allocateInboundQueue([urgent, booked], [dock], state);
  expect(booked.task.unloadingPointId).toBe(dock.id);
  expect(state.reservations.get(booked.task)).toBe(slot);
  expect(urgent.task.unloadingPointId).toBeUndefined();
  expect(state.reservations.get(urgent.task)?.startsAtMs).toBe(slot.endsAtMs);
});

it('moves a provisional general assignment to free a cold dock for the next visit', () => {
  const general = candidate('plain', false, true);
  const cold = candidate('cold', true, false, true);
  const wideDock = { canHandleOversize: true, hasColdZone: false, id: 'D02' };
  allocateInboundQueue([general, cold], [dock, wideDock], allocation());
  expect(general.task.unloadingPointId).toBe(wideDock.id);
  expect(cold.task.unloadingPointId).toBe(dock.id);
});

it('treats a newly booked future slot like a saved slot when assigning legacy visits that can enter now', () => {
  const general = candidate('general', false, true);
  const booked = candidate('booked', true, false, true);
  const cold = candidate('cold', false, false, true);
  const wideDock = { canHandleOversize: true, hasColdZone: false, id: 'D02' };
  const state = allocation();
  const startsAtMs = worldTimeMs + 300_000;
  const { dockSchedule } = booked.task;
  if (dockSchedule === undefined) {
    throw new Error('Missing dock schedule');
  }
  dockSchedule.preferredStartsAt = timestampFromMs(startsAtMs);
  allocateInboundQueue([general, booked, cold], [dock, wideDock], state);
  expect(general.task.unloadingPointId).toBe(wideDock.id);
  expect(cold.task.unloadingPointId).toBe(dock.id);
  expect(state.reservations.get(booked.task)?.startsAtMs).toBe(startsAtMs);

  state.changed.clear();
  allocateInboundQueue([booked], [dock, wideDock], state);
  expect(state.changed.size).toBe(0);
  expect(booked.task.unloadingPointId).toBeUndefined();
});

it('assigns and books thirty visits on six docks deterministically with no overlap', () => {
  const docks = Array.from({ length: 6 }, (_, index) => ({ ...dock, id: `D0${String(index + 1)}` }));
  const visits = Array.from({ length: 30 }, (_, index) => candidate(String(index), true, index % 4 === 0));
  const ordered = rankYardQueue(visits, DEFAULT_YARD_QUEUE_WEIGHTS, worldTimeMs, day);
  const state = allocation();
  allocateInboundQueue(ordered, docks, state);
  expect(state.reservations.size).toBe(30);
  for (const { id } of docks) {
    const slots = [...state.reservations.values()].filter(slot => slot.dockId === id);
    expect(slots.map(slot => slot.startsAtMs)).toEqual(Array.from({ length: 5 }, (_, index) =>
      worldTimeMs + index * INBOUND_DOCK_SLOT_DURATION_MS));
  }
  expect(state.occupied.size).toBe(6);
  state.changed.clear();
  allocateInboundQueue(ordered.filter(({ task }) => task.unloadingPointId === undefined), docks, state);
  expect(state.changed.size).toBe(0);
});
