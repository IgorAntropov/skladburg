import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type { WarehouseEquipmentUnit } from '@skladburg/contracts/wms/v1/warehouse_equipment';

import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';
import {
  WarehouseEquipmentKind,
  WarehouseEquipmentTaskKind,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';

import type { IStateReader } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { toCalendarDate } from '../../calendar/index';
import { readOutboundTask } from './outboundRecords';
import { readWarehouseEquipmentRecord } from './warehouseEquipmentRecords';
import {
  advanceWarehouseEquipment,
  isWarehouseEquipmentWorking,
  isWarehouseForkliftAvailable,
} from './warehouseEquipmentSimulation';
import { getWarehouseShiftPlan } from './warehouseStaffShifts';
import { hasWarehouseStaffQualification } from './warehouseTaskQualifications';

type ResourceAvailabilityValue = (task: ReceivingTask) => boolean | undefined;

export const readWarehouseYardResources = (
  read: IStateReader,
  runtime: Pick<IModuleRuntime, 'errors' | 'wmsStaff' | 'wmsStaffSchedules'>,
  { receivingAreaId, tenantId, warehouseId }: { receivingAreaId: string; tenantId: string; warehouseId: string },
  worldTimeMs: number,
  warehouseTasks: readonly ReceivingTask[],
): ResourceAvailabilityValue => {
  const warehouse = read.get('warehouses', warehouseId);
  const slots = runtime.wmsStaffSchedules?.get(warehouseId)?.filter(slot => slot.areaId === receivingAreaId);
  if (warehouse?.tenantId !== tenantId || warehouse.timeZone === '' || runtime.wmsStaff === undefined
    || slots === undefined || slots.length === 0) {
    return () => undefined;
  }
  const today = toCalendarDate(worldTimeMs, warehouse.timeZone);
  const { shift } = getWarehouseShiftPlan(slots, worldTimeMs, warehouse.timeZone);
  const memberships = new Set(read.listBy('memberships', 'organizationId', tenantId).map(membership => membership.userId));
  const staff = runtime.wmsStaff.filter(member => member.warehouseId === warehouseId && member.organizationId === tenantId
    && member.workplace?.areaId === receivingAreaId && memberships.has(member.userId) && read.get('users', member.userId) !== undefined);
  const equipment = readWarehouseEquipmentRecord(read, warehouseId);
  const fleet = equipment?.tenantId === tenantId ? equipment : undefined;
  if (fleet !== undefined) {
    advanceWarehouseEquipment(fleet, BigInt(worldTimeMs));
  }
  const hasFreeForklift = fleet?.equipment.some(({ unit }) => isWarehouseForkliftAvailable(unit));
  const equipmentByDriver = new Map<string, WarehouseEquipmentUnit>();
  for (const { unit } of fleet?.equipment ?? []) {
    if (unit?.driverStaffId !== undefined) {
      equipmentByDriver.set(unit.driverStaffId, unit);
    }
  }
  const potentiallyOffShiftCount = Math.max(staff.length - shift.onShiftCount, shift.offSiteCount + shift.onBreakCount);
  const receipts = new Map<string, null | string>();
  for (const task of warehouseTasks) {
    if (task.warehouseId === warehouseId && task.status === ReceivingTaskStatus.IN_PROGRESS && task.assigneeUserId !== undefined) {
      receipts.set(task.assigneeUserId, receipts.has(task.assigneeUserId) ? null : task.id);
    }
  }
  const pickers = new Set<string>();
  for (const record of read.listBy('warehouseOutbound', 'scopeId', warehouseId)) {
    if (record.lookupKey === tenantId) {
      const task = readOutboundTask(record, runtime.errors);
      if (task.status === PickingTaskStatus.IN_PROGRESS && task.assigneeUserId !== undefined) {
        pickers.add(task.assigneeUserId);
      }
    }
  }
  return (task) => {
    const needsForklift = task.requiredQualifications.includes(WarehouseStaffQualificationKind.FORKLIFT);
    const isClaimed = task.status === ReceivingTaskStatus.IN_PROGRESS;
    if (task.warehouseId !== warehouseId || task.receivingAreaId !== receivingAreaId || (needsForklift && fleet === undefined)
      || (isClaimed && task.assigneeUserId === undefined)) {
      return undefined;
    }
    if (shift.onShiftCount === 0) {
      return false;
    }
    const eligible = staff.filter(({ credentials, userId }) => {
      const receipt = receipts.get(userId);
      if ((isClaimed && userId !== task.assigneeUserId) || pickers.has(userId) || (receipt !== undefined && receipt !== task.id)) {
        return false;
      }
      if (!task.requiredQualifications.every(kind => hasWarehouseStaffQualification(credentials, kind, today))) {
        return false;
      }
      const assigned = equipmentByDriver.get(userId);
      if (assigned !== undefined) {
        return needsForklift && isClaimed && assigned.kind === WarehouseEquipmentKind.FORKLIFT
          && isWarehouseEquipmentWorking(assigned.status) && assigned.taskKind === WarehouseEquipmentTaskKind.RECEIVING
          && assigned.taskId === task.id;
      }
      return !needsForklift || (!isClaimed && hasFreeForklift === true);
    });
    if (eligible.length === 0) {
      return false;
    }
    return eligible.length > potentiallyOffShiftCount ? true : undefined;
  };
};
