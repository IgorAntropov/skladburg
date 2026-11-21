import type { WarehouseStaffShiftSummary } from '@skladburg/contracts/wms/v1/warehouse_staff_presence';

import type { IModuleRuntime } from '../moduleRuntime';

import {
  getLocalMinuteOfDay,
  getZoneOffsetMs,
} from '../../calendar/zonedTime';
import { notifyWaitingYardOfResourceChange } from './inboundTaskRecords';
import {
  publishWarehouseStaffPresenceChanged,
  publishWarehouseStaffProfilesChanged,
} from './warehouseStaffPresenceEvents';

export interface WarehouseStaffAssignmentValue {
  areaId: string;
  breakEndMinute: number;
  breakStartMinute: number;
  endMinute: number;
  staffCount: number;
  startMinute: number;
}

type ShiftCountsValue = Pick<WarehouseStaffShiftSummary, 'offSiteCount' | 'onBreakCount' | 'onShiftCount'>;

interface WarehouseShiftPlanValue {
  plannedByArea: ReadonlyMap<string, number>;
  shift: ShiftCountsValue;
}

const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 24 * 60;

const includesMinute = (minute: number, start: number, end: number): boolean =>
  start <= end ? minute >= start && minute < end : minute >= start || minute < end;

const getShiftState = (minute: number, assignment: WarehouseStaffAssignmentValue): keyof ShiftCountsValue => {
  if (!includesMinute(minute, assignment.startMinute, assignment.endMinute)) {
    return 'offSiteCount';
  }

  return includesMinute(minute, assignment.breakStartMinute, assignment.breakEndMinute) ? 'onBreakCount' : 'onShiftCount';
};

export const getWarehouseShiftPlan = (
  assignments: readonly WarehouseStaffAssignmentValue[], worldTimeMs: number, timeZone: string,
): WarehouseShiftPlanValue => {
  const minute = getLocalMinuteOfDay(worldTimeMs, timeZone);
  const shift = { offSiteCount: 0, onBreakCount: 0, onShiftCount: 0 };
  const plannedByArea = new Map<string, number>();
  for (const assignment of assignments) {
    const state = getShiftState(minute, assignment);
    shift[state] += assignment.staffCount;
    const planned = state === 'onShiftCount' ? assignment.staffCount : 0;
    plannedByArea.set(assignment.areaId, (plannedByArea.get(assignment.areaId) ?? 0) + planned);
  }
  return { plannedByArea, shift };
};

export const publishWarehouseShiftChanges = async (runtime: IModuleRuntime, previousMs: number, currentMs: number): Promise<void> => {
  const changes: { areaIds: string[]; isNewDate: boolean; warehouseId: string }[] = [];
  const warehouses = new Set(runtime.wmsStaffSchedules?.keys());
  for (const member of runtime.wmsStaff ?? []) {
    warehouses.add(member.warehouseId);
  }
  for (const warehouseId of warehouses) {
    const assignments = runtime.wmsStaffSchedules?.get(warehouseId) ?? [];
    const warehouse = runtime.read.get('warehouses', warehouseId);
    if (warehouse !== undefined && warehouse.timeZone !== '') {
      const previous = Math.floor((previousMs + getZoneOffsetMs(previousMs, warehouse.timeZone)) / MINUTE_MS);
      const current = Math.floor((currentMs + getZoneOffsetMs(currentMs, warehouse.timeZone)) / MINUTE_MS);
      const crossed = (minute: number): boolean =>
        Math.floor((previous - minute) / MINUTES_PER_DAY) !== Math.floor((current - minute) / MINUTES_PER_DAY);
      const areaIds = assignments.filter(slot =>
        crossed(slot.startMinute) || crossed(slot.breakStartMinute) || crossed(slot.breakEndMinute) || crossed(slot.endMinute))
        .map(slot => slot.areaId);
      const isNewDate = crossed(0);
      if (areaIds.length > 0 || isNewDate) {
        changes.push({ areaIds, isNewDate, warehouseId });
      }
    }
  }
  if (changes.length > 0) {
    await runtime.command((transaction) => {
      for (const { areaIds, isNewDate, warehouseId } of changes) {
        publishWarehouseStaffProfilesChanged(transaction, runtime.outbox, warehouseId);
        if (areaIds.length > 0) {
          publishWarehouseStaffPresenceChanged(transaction, runtime.outbox, warehouseId);
        }
        notifyWaitingYardOfResourceChange(transaction, runtime, warehouseId,
          task => areaIds.includes(task.receivingAreaId) || (isNewDate && task.requiredQualifications.length > 0));
      }
    });
  }
};
