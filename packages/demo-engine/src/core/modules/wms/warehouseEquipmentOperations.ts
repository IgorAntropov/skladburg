import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import {
  WarehouseEquipmentStatus,
  WarehouseEquipmentTaskKind,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { compareIds } from '../../state/table';
import { notifyWaitingYardOfResourceChange } from './inboundTaskRecords';
import {
  decodeWarehouseEquipmentRecord,
  publishWarehouseEquipmentChanged,
  readWarehouseEquipmentRecord,
  saveWarehouseEquipmentRecord,
} from './warehouseEquipmentRecords';
import {
  advanceWarehouseEquipment,
  isWarehouseForkliftAvailable,
} from './warehouseEquipmentSimulation';

type EquipmentAction = 'cancel' | 'carry' | 'claim' | 'finish' | 'handle';

export const applyWarehouseEquipmentOperation = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  tenantId: string,
  task: PickingTask | ReceivingTask,
  action: EquipmentAction,
): void => {
  if (!task.requiredQualifications.includes(WarehouseStaffQualificationKind.FORKLIFT)) {
    return;
  }
  const record = readWarehouseEquipmentRecord(transaction, task.warehouseId);
  if (record?.tenantId !== tenantId) {
    if (action === 'claim') {
      throw runtime.errors.create(ErrorCode.WAREHOUSE_EQUIPMENT_UNAVAILABLE);
    }
    return;
  }
  const nowMs = BigInt(transaction.worldTimeMs);
  advanceWarehouseEquipment(record, nowMs);
  const taskKind = task.$typeName === 'wms.v1.PickingTask' ? WarehouseEquipmentTaskKind.PICKING : WarehouseEquipmentTaskKind.RECEIVING;
  if (action === 'claim') {
    const driverId = task.assigneeUserId;
    if (driverId === undefined) {
      throw runtime.errors.internal();
    }
    const entry = record.equipment.filter(({ unit }) => isWarehouseForkliftAvailable(unit))
      .sort((current, prev) => compareIds(current.unit?.code ?? '', prev.unit?.code ?? ''))[0];
    if (entry?.unit === undefined || record.equipment.some(({ unit }) => unit?.driverStaffId === driverId)) {
      throw runtime.errors.create(ErrorCode.WAREHOUSE_EQUIPMENT_UNAVAILABLE);
    }
    entry.unit.status = WarehouseEquipmentStatus.TO_TASK;
    entry.unit.driverStaffId = driverId;
    entry.unit.taskId = task.id;
    entry.unit.taskKind = taskKind;
    entry.updatedAtMs = nowMs;
  }
  else {
    const entry = record.equipment.find(({ unit }) => unit?.taskId === task.id && unit.taskKind === taskKind);
    if (entry?.unit === undefined) {
      return;
    }
    const { unit } = entry;
    if (action !== 'cancel') {
      unit.batteryPercent = Math.max(0, unit.batteryPercent - 1);
    }
    if (action === 'finish' || action === 'cancel') {
      unit.taskId = undefined;
      unit.taskKind = undefined;
      unit.driverStaffId = undefined;
      unit.status = WarehouseEquipmentStatus.AVAILABLE;
      entry.updatedAtMs = nowMs;
      advanceWarehouseEquipment(record, nowMs);
    }
    else {
      unit.status = action === 'carry' ? WarehouseEquipmentStatus.CARRYING : WarehouseEquipmentStatus.HANDLING;
    }
  }
  saveWarehouseEquipmentRecord(transaction, record);
  publishWarehouseEquipmentChanged(transaction, runtime.outbox, record.warehouseId);
};

export const refreshWarehouseEquipment = (runtime: IModuleRuntime): Promise<void> => runtime.command((transaction) => {
  const nowMs = BigInt(transaction.worldTimeMs);
  for (const stored of transaction.list('warehouseEquipment')) {
    const record = decodeWarehouseEquipmentRecord(stored);
    const hadAvailableForklift = record.equipment.some(({ unit }) => isWarehouseForkliftAvailable(unit));
    if (advanceWarehouseEquipment(record, nowMs)) {
      saveWarehouseEquipmentRecord(transaction, record);
      publishWarehouseEquipmentChanged(transaction, runtime.outbox, record.warehouseId);
      if (!hadAvailableForklift && record.equipment.some(({ unit }) => isWarehouseForkliftAvailable(unit))) {
        notifyWaitingYardOfResourceChange(transaction, runtime, record.warehouseId,
          task => task.requiredQualifications.includes(WarehouseStaffQualificationKind.FORKLIFT));
      }
    }
  }
});
