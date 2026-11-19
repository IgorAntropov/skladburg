import type {
  ReceivingTask,
  YardWaitingReason,
} from '@skladburg/contracts/wms/v1/receiving';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  ReceivingTaskStatus,
  YardAdmissionStatus,
  YardWaitingReasonCode,
} from '@skladburg/contracts/wms/v1/receiving';

export interface YardDispatchVisitValue {
  reason: undefined | YardWaitingReason;
  slotEndMs: number | undefined;
  slotStartMs: number | undefined;
  state: YardDispatchVisitStateValue;
  task: ReceivingTask;
  unloadingPointId: string | undefined;
}

interface YardDispatchGroupsValue {
  docked: YardDispatchVisitValue[];
  queue: YardDispatchVisitValue[];
  slots: YardDispatchVisitValue[];
  waiting: YardDispatchVisitValue[];
}

type YardDispatchVisitStateValue = 'assigned' | 'blocked' | 'queue' | 'slot' | 'unloading';

const isActive = (task: ReceivingTask): boolean =>
  task.status === ReceivingTaskStatus.OPEN || task.status === ReceivingTaskStatus.IN_PROGRESS;

const isInYard = (task: ReceivingTask): boolean => task.yardAdmissionStatus === YardAdmissionStatus.ADMITTED
  || task.yardAdmissionStatus === YardAdmissionStatus.PASS_REJECTED || task.yardAdmissionStatus === YardAdmissionStatus.WAITING_DOCK
  || task.yardAdmissionStatus === YardAdmissionStatus.WAITING_DOCUMENTS;

const isUnrankedWait = (reason: undefined | YardWaitingReason): boolean => reason?.reason === YardWaitingReasonCode.PASS_REJECTED
  || reason?.reason === YardWaitingReasonCode.NO_COMPATIBLE_DOCK || reason?.reason === YardWaitingReasonCode.WAITING_DOCUMENTS;

export const readYardDispatchGroups = (
  tasks: readonly ReceivingTask[],
  reasons: ReadonlyMap<string, YardWaitingReason>,
): YardDispatchGroupsValue => {
  const groups: YardDispatchGroupsValue = { docked: [], queue: [], slots: [], waiting: [] };
  for (const task of tasks) {
    if (!isActive(task)) {
      continue;
    }

    const projectedReason = reasons.get(task.id);
    const reason = projectedReason?.taskVersion === task.version ? projectedReason : undefined;
    const storedReservation = task.dockSchedule?.reservation;
    const isDocked = task.receivedUnits.length > 0 || task.unloadingPointId !== undefined;
    const hasWaitingReservation = reason !== undefined && reason.queuePosition === undefined && !isUnrankedWait(reason);
    const reservation = (isDocked ? storedReservation?.unloadingPointId === task.unloadingPointId : hasWaitingReservation)
      ? storedReservation
      : undefined;
    const slotStartMs = reservation?.startsAt === undefined ? undefined : timestampMs(reservation.startsAt);
    const slotEndMs = reservation?.endsAt === undefined ? undefined : timestampMs(reservation.endsAt);
    const unloadingPointId = task.unloadingPointId ?? reservation?.unloadingPointId;
    const visit = { reason, slotEndMs, slotStartMs, task, unloadingPointId };
    if (isDocked) {
      groups.docked.push({ ...visit, state: task.receivedUnits.length > 0 ? 'unloading' : 'assigned' });
    }
    else if (reason?.queuePosition !== undefined) {
      groups.queue.push({ ...visit, state: 'queue' });
    }
    else if (slotStartMs !== undefined && slotEndMs !== undefined) {
      groups.slots.push({ ...visit, state: 'slot' });
    }
    else if (reason !== undefined || isInYard(task) || task.dockSchedule !== undefined) {
      groups.waiting.push({ ...visit, state: 'blocked' });
    }
  }

  groups.queue.sort((current, prev) => (current.reason?.queuePosition ?? 0) - (prev.reason?.queuePosition ?? 0));
  groups.slots.sort((current, prev) => (current.slotStartMs ?? 0) - (prev.slotStartMs ?? 0));
  return groups;
};
