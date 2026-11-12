import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  type PickingTask,
  PickingTaskSchema,
  PickingTaskStatus,
} from '@skladburg/contracts/wms/v1/picking';
import { PickingTasksChangedSchema } from '@skladburg/contracts/wms/v1/picking_events';

import type { IDomainErrors } from '../../errors/index';
import type { IStateTransaction } from '../../state/index';
import type { WarehouseStockRecordValue } from '../../state/records';
import type { IModuleRuntime } from '../moduleRuntime';

export const readOutboundTask = (record: WarehouseStockRecordValue, errors: IDomainErrors): PickingTask => {
  const task = fromBinary(PickingTaskSchema, record.bytes);

  if (task.id !== record.id || task.dealId !== record.id || task.warehouseId !== record.scopeId || task.units.length === 0
    || task.units.some(unit => unit.handlingUnit?.tenantId !== record.lookupKey || unit.handlingUnit.warehouseId !== record.scopeId)) {
    throw errors.internal();
  }

  return task;
};

export const saveOutboundTask = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  task: PickingTask,
  tenantId: string,
  isTaskVisible: boolean,
): void => {
  transaction.put('warehouseOutbound', {
    bytes: toBinary(PickingTaskSchema, task),
    id: task.id,
    lookupKey: tenantId,
    scopeId: task.warehouseId,
  });

  if (isTaskVisible) {
    runtime.outbox.add(transaction, tasksChannel(task.warehouseId), {
      case: 'pickingTasksChanged',
      value: create(PickingTasksChangedSchema, { warehouseId: task.warehouseId }),
    });
  }
};

export const openOutboundTask = (transaction: IStateTransaction, runtime: IModuleRuntime, dealId: string): void => {
  const record = transaction.get('warehouseOutbound', dealId);
  if (record === undefined) {
    return;
  }

  const task = readOutboundTask(record, runtime.errors);
  if (task.status !== PickingTaskStatus.UNSPECIFIED) {
    throw runtime.errors.internal();
  }

  task.status = PickingTaskStatus.OPEN;
  task.version = 1;
  saveOutboundTask(transaction, runtime, task, record.lookupKey, true);
};
