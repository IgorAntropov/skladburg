import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  type ReceivingTask,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { ReceivingTasksChangedSchema } from '@skladburg/contracts/wms/v1/receiving_events';

import type { IDomainErrors } from '../../errors/index';
import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { WarehouseStockRecordValue } from '../../state/records';
import type { IModuleRuntime } from '../moduleRuntime';

export const readInboundTask = (record: WarehouseStockRecordValue, errors: IDomainErrors): ReceivingTask => {
  const task = fromBinary(ReceivingTaskSchema, record.bytes);
  if (task.id !== record.id || task.dealId !== record.id || task.warehouseId !== record.scopeId
    || task.receivingAreaId === '' || task.orderLines.length === 0 || task.expectedUnits.length === 0) {
    throw errors.internal();
  }

  return task;
};

export const saveInboundTask = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  task: ReceivingTask,
  tenantId: string,
): void => {
  transaction.put('warehouseInbound', {
    bytes: toBinary(ReceivingTaskSchema, task),
    id: task.id,
    lookupKey: tenantId,
    scopeId: task.warehouseId,
  });

  if (task.version > 0) {
    runtime.outbox.add(transaction, tasksChannel(task.warehouseId), {
      case: 'receivingTasksChanged',
      value: create(ReceivingTasksChangedSchema, { warehouseId: task.warehouseId }),
    });
  }
};

export const openInboundTask = (transaction: IStateTransaction, runtime: IModuleRuntime, dealId: string): void => {
  const record = transaction.get('warehouseInbound', dealId);
  if (record === undefined) {
    return;
  }
  const task = readInboundTask(record, runtime.errors);
  if (task.status !== ReceivingTaskStatus.UNSPECIFIED || task.version !== 0) {
    throw runtime.errors.internal();
  }

  task.status = ReceivingTaskStatus.OPEN;
  task.version = 1;
  saveInboundTask(transaction, runtime, task, record.lookupKey);
};

export const hasInboundProduct = (reader: IStateReader, errors: IDomainErrors, tenantId: string, productId: string): boolean =>
  reader.listBy('warehouses', 'tenantId', tenantId).some(warehouse =>
    reader.listBy('warehouseInbound', 'scopeId', warehouse.id).some(record =>
      record.lookupKey === tenantId && readInboundTask(record, errors).orderLines.some(line => line.productId === productId)));
