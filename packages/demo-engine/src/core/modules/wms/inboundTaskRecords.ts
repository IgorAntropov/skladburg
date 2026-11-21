import {
  create,
  fromBinary,
} from '@bufbuild/protobuf';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  type ReceivingTask,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { ReceivingTasksChangedSchema } from '@skladburg/contracts/wms/v1/receiving_events';

import type { IDomainErrors } from '../../errors/index';
import type { IStateTransaction } from '../../state/index';
import type { WarehouseStockRecordValue } from '../../state/records';
import type { IModuleRuntime } from '../moduleRuntime';

export const isReceivingTaskActive = (task: ReceivingTask): boolean =>
  task.status === ReceivingTaskStatus.OPEN || task.status === ReceivingTaskStatus.IN_PROGRESS;

export const readInboundTask = (record: WarehouseStockRecordValue, errors: IDomainErrors): ReceivingTask => {
  const task = fromBinary(ReceivingTaskSchema, record.bytes);
  if (task.id !== record.id || task.dealId !== record.id || task.warehouseId !== record.scopeId
    || task.receivingAreaId === '' || task.orderLines.length === 0 || task.expectedUnits.length === 0) {
    throw errors.internal();
  }

  return task;
};

export const publishReceivingTasksChanged = (
  transaction: IStateTransaction,
  { outbox }: Pick<IModuleRuntime, 'outbox'>,
  warehouseId: string,
): void => {
  outbox.add(transaction, tasksChannel(warehouseId), {
    case: 'receivingTasksChanged',
    value: create(ReceivingTasksChangedSchema, { warehouseId }),
  });
};

export const notifyWaitingYardOfResourceChange = (
  transaction: IStateTransaction, runtime: IModuleRuntime, warehouseId: string, affects: (task: ReceivingTask) => boolean,
): void => {
  const warehouse = transaction.get('warehouses', warehouseId);
  if (warehouse === undefined || !runtime.wmsStaffSchedules?.has(warehouseId)
    || transaction.get('yardQueuePolicies', warehouse.tenantId)?.weights?.resourceAvailabilityWeight === 0) {
    return;
  }
  const hasWaitingTask = transaction.listBy('warehouseInbound', 'scopeId', warehouseId).some((record) => {
    if (record.lookupKey !== warehouse.tenantId) {
      return false;
    }
    const task = readInboundTask(record, runtime.errors);
    return task.version > 0 && task.unloadingPointId === undefined && isReceivingTaskActive(task) && affects(task);
  });
  if (hasWaitingTask) {
    publishReceivingTasksChanged(transaction, runtime, warehouseId);
  }
};
