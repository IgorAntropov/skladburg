import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  YardWaitingReasonCode,
  YardWaitingReasonSchema,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  expect,
  it,
} from 'vitest';

import { readYardDispatchGroups } from './yardDispatchRows';

const visit = create(ReceivingTaskSchema, {
  dockSchedule: { reservation: { endsAt: timestampFromMs(1_800_000), startsAt: timestampFromMs(0), unloadingPointId: 'dock-6' } },
  id: 'visit-1',
  status: ReceivingTaskStatus.OPEN,
  version: 2,
});

it('shows the dock and interval only while the waiting projection still recognizes the reservation', () => {
  const expired = create(YardWaitingReasonSchema, {
    queuePosition: 1, reason: YardWaitingReasonCode.WAITING_ASSIGNMENT, receivingTaskId: visit.id, taskVersion: visit.version,
  });
  const blocked = create(YardWaitingReasonSchema, {
    reason: YardWaitingReasonCode.WAITING_DOCUMENTS, receivingTaskId: visit.id, taskVersion: visit.version,
  });
  const booked = create(YardWaitingReasonSchema, {
    reason: YardWaitingReasonCode.BOOKED_DOCK_BUSY, receivingTaskId: visit.id, taskVersion: visit.version,
  });

  expect(readYardDispatchGroups([visit], new Map([[visit.id, expired]])).queue[0]).toMatchObject({
    slotEndMs: undefined, slotStartMs: undefined, unloadingPointId: undefined,
  });
  expect(readYardDispatchGroups([visit], new Map([[visit.id, blocked]])).waiting[0]).toMatchObject({
    slotEndMs: undefined, slotStartMs: undefined, unloadingPointId: undefined,
  });
  expect(readYardDispatchGroups([visit], new Map([[visit.id, booked]])).slots[0]).toMatchObject({
    slotEndMs: 1_800_000, slotStartMs: 0, unloadingPointId: 'dock-6',
  });
});
