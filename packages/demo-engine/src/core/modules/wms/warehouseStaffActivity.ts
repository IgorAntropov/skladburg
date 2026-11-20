import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { WarehouseStaffTask } from '@skladburg/contracts/wms/v1/warehouse_staff_profile';

import { create } from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';
import {
  type WarehouseStaffPerformance,
  WarehouseStaffPerformanceSchema,
  WarehouseStaffShiftState,
  WarehouseStaffTaskKind,
  WarehouseStaffTaskSchema,
} from '@skladburg/contracts/wms/v1/warehouse_staff_profile';

import type { IModuleRuntime } from '../moduleRuntime';
import type { WarehouseStaffMemberValue } from './warehouseStaffRoster';
import type { WarehouseStaffAssignmentValue } from './warehouseStaffShifts';

import {
  getIsoWeekdayOfEpochDay,
  toEpochDay,
} from '../../calendar/calendarDate';
import {
  getLocalMinuteOfDay,
  toCalendarDate,
} from '../../calendar/zonedTime';
import { readInboundTask } from './inboundRecords';
import { readOutboundTask } from './outboundRecords';
import { getWarehouseShiftPlan } from './warehouseStaffShifts';

interface StaffActivityValue {
  activeTasks: WarehouseStaffTask[];
  history: WarehouseStaffTask[];
}

export const readStaffActivity = (runtime: IModuleRuntime, member: WarehouseStaffMemberValue, hasHistory: boolean): StaffActivityValue => {
  const { errors, read } = runtime;
  const activeTasks: WarehouseStaffTask[] = [];
  const history: WarehouseStaffTask[] = [];
  const append = (taskId: string, reference: string, kind: WarehouseStaffTaskKind, at: Timestamp | undefined, isActive: boolean): void => {
    if (isActive) {
      activeTasks.push(create(WarehouseStaffTaskSchema, { kind, reference, taskId }));
    }
    if (hasHistory && at !== undefined) {
      history.push(create(WarehouseStaffTaskSchema, { completedAt: at, kind, reference, taskId }));
    }
  };

  for (const record of read.listBy('warehouseInbound', 'scopeId', member.warehouseId)) {
    if (record.lookupKey === member.organizationId) {
      const task = readInboundTask(record, errors);
      if (task.assigneeUserId === member.userId) {
        append(task.id, task.sourceDocumentNumber, WarehouseStaffTaskKind.RECEIVING,
          task.finishedAt, task.status === ReceivingTaskStatus.IN_PROGRESS);
      }
    }
  }
  for (const record of read.listBy('warehouseOutbound', 'scopeId', member.warehouseId)) {
    if (record.lookupKey === member.organizationId) {
      const task = readOutboundTask(record, errors);
      if (task.assigneeUserId === member.userId) {
        const deal = read.get('deals', task.dealId);
        append(task.id, deal === undefined ? task.id : String(deal.number), WarehouseStaffTaskKind.PICKING,
          task.pickedAt, task.status === PickingTaskStatus.IN_PROGRESS);
      }
    }
  }
  history.sort((current, prev) => {
    const byTime = (prev.completedAt === undefined ? 0 : timestampMs(prev.completedAt))
      - (current.completedAt === undefined ? 0 : timestampMs(current.completedAt));
    return byTime || current.taskId.localeCompare(prev.taskId);
  });
  return { activeTasks, history };
};

export const readStaffShiftState = (
  assignment: undefined | WarehouseStaffAssignmentValue, worldTimeMs: number, timeZone: string,
): undefined | WarehouseStaffShiftState => {
  if (assignment === undefined) {
    return undefined;
  }
  const { shift } = getWarehouseShiftPlan([assignment], worldTimeMs, timeZone);
  if (shift.onShiftCount > 0) {
    return WarehouseStaffShiftState.ON_SHIFT;
  }
  return shift.onBreakCount > 0 ? WarehouseStaffShiftState.ON_BREAK : WarehouseStaffShiftState.OFF_SITE;
};

export const readStaffPerformance = (
  history: WarehouseStaffTask[], assignment: undefined | WarehouseStaffAssignmentValue, worldTimeMs: number, timeZone: string,
): WarehouseStaffPerformance => {
  const today = toEpochDay(toCalendarDate(worldTimeMs, timeZone));
  const weekStart = today + 1 - getIsoWeekdayOfEpochDay(today);
  const minute = getLocalMinuteOfDay(worldTimeMs, timeZone);
  let shiftCount = 0;
  let weekCount = 0;
  for (const task of history) {
    if (task.completedAt === undefined) {
      continue;
    }
    const instant = timestampMs(task.completedAt);
    const day = toEpochDay(toCalendarDate(instant, timeZone));
    if (instant > worldTimeMs) {
      continue;
    }
    if (weekStart <= day) {
      weekCount++;
    }
    if (assignment !== undefined) {
      const overnight = assignment.startMinute > assignment.endMinute;
      const startDay = overnight && minute < assignment.endMinute ? today - 1 : today;
      const minuteFromStartDay = (day - startDay) * 1440 + getLocalMinuteOfDay(instant, timeZone);
      if (minuteFromStartDay >= assignment.startMinute && minuteFromStartDay < assignment.endMinute + (overnight ? 1440 : 0)) {
        shiftCount++;
      }
    }
  }
  return create(WarehouseStaffPerformanceSchema, {
    completedThisShift: assignment === undefined ? undefined : shiftCount,
    completedThisWeek: weekCount,
    history,
  });
};
