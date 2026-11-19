import {
  expect,
  it,
} from 'vitest';

import type {
  InboundDockSlotValue,
  InboundSlotDockValue,
} from './inboundDockSlots';

import { findInboundDockSlot } from './inboundDockSlots';

const MINUTE_MS = 60_000;
const START_MS = Date.UTC(2026, 10, 19, 10, 5);
const ordinaryCargo = { hasColdCargo: false, hasOversizeCargo: false };

const createDock = (id: string, fields: Partial<InboundSlotDockValue> = {}): InboundSlotDockValue => ({
  availableFromMs: Number.NEGATIVE_INFINITY,
  canHandleOversize: false,
  hasColdZone: false,
  id,
  ...fields,
});

const slot = (dockId: string, startsAfterMinutes: number, endsAfterMinutes: number): InboundDockSlotValue => ({
  dockId,
  endsAtMs: START_MS + endsAfterMinutes * MINUTE_MS,
  startsAtMs: START_MS + startsAfterMinutes * MINUTE_MS,
});

it('starts a full 30-minute reservation at the proposed arrival time on an empty dock', () => {
  expect(findInboundDockSlot([createDock('D01')], ordinaryCargo, [], START_MS)).toEqual(slot('D01', 0, 30));
});

it('fits an exactly 30-minute gap between adjacent half-open reservations', () => {
  const reservations = [slot('D01', 30, 60), slot('D02', 0, 30), slot('D01', -30, 0)];

  expect(findInboundDockSlot([createDock('D01')], ordinaryCargo, reservations, START_MS)).toEqual(slot('D01', 0, 30));
});

it('skips a gap shorter than the full slot and uses the earliest compatible dock', () => {
  const reservations = [slot('D02', 0, 35), slot('D01', 45, 75), slot('D01', 0, 20)];

  expect(findInboundDockSlot([createDock('D01'), createDock('D02')], ordinaryCargo, reservations, START_MS))
    .toEqual(slot('D02', 35, 65));
});

it('uses known release times and leaves docks with unknown release unavailable', () => {
  const docks = [createDock('D01', { availableFromMs: undefined }), createDock('D02', { availableFromMs: START_MS + 12 * MINUTE_MS })];

  expect(findInboundDockSlot(docks, ordinaryCargo, [], START_MS)).toEqual(slot('D02', 12, 42));
  expect(findInboundDockSlot(docks.slice(0, 1), ordinaryCargo, [], START_MS)).toBeUndefined();
});

it('requires a single dock that supports both cold and oversized cargo', () => {
  const docks = [
    createDock('D01', { hasColdZone: true }),
    createDock('D02', { canHandleOversize: true }),
    createDock('D03', { canHandleOversize: true, hasColdZone: true }),
  ];
  const cargo = { hasColdCargo: true, hasOversizeCargo: true };

  expect(findInboundDockSlot(docks, cargo, [slot('D03', 0, 30)], START_MS)).toEqual(slot('D03', 30, 60));
  expect(findInboundDockSlot(docks.slice(0, 2), cargo, [], START_MS)).toBeUndefined();
});

it('breaks equal-time ties by lower specialization and then stable dock identifier', () => {
  const docks = [createDock('D01', { hasColdZone: true }), createDock('D03'), createDock('D02')];

  expect(findInboundDockSlot(docks, ordinaryCargo, [], START_MS)).toEqual(slot('D02', 0, 30));
  expect(findInboundDockSlot(docks.toReversed(), ordinaryCargo, [], START_MS)).toEqual(slot('D02', 0, 30));
});

it('books 30 competing visits on six docks without overlapping a reserved interval', () => {
  const dockIds = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'];
  const docks = dockIds.toReversed().map(id => createDock(id));
  const reservations: InboundDockSlotValue[] = [];

  for (let visit = 0; visit < 30; visit += 1) {
    const reservation = findInboundDockSlot(docks, ordinaryCargo, reservations, START_MS);
    expect(reservation).toBeDefined();
    if (reservation !== undefined) {
      reservations.push(reservation);
    }
  }

  expect(reservations).toEqual([0, 30, 60, 90, 120].flatMap(start => dockIds.map(id => slot(id, start, start + 30))));
});
