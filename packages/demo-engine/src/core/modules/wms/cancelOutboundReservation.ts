import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import { StockMovementKind } from '@skladburg/contracts/wms/v1/stock';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  readOutboundTask,
  saveOutboundTask,
} from './outboundRecords';
import {
  applyOutboundMovement,
  readReservedUnits,
} from './outboundReservation';
import { publishStockAvailabilityChanged } from './stockRecords';
import { applyWarehouseEquipmentOperation } from './warehouseEquipmentOperations';

export const cancelOutboundReservation = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  deal: Deal,
  actorUserId: string,
): void => {
  const record = transaction.get('warehouseOutbound', deal.id);
  if (record === undefined) {
    return;
  }
  const task = readOutboundTask(record, runtime.errors);
  const tenantId = deal.supplierOrganizationId;
  if (record.lookupKey !== tenantId || task.warehouseId !== deal.shipFromWarehouseId) {
    throw runtime.errors.internal();
  }

  const reserved = readReservedUnits(transaction, runtime, task.units, task.warehouseId, tenantId);
  for (const balance of reserved) {
    applyOutboundMovement(transaction, runtime, deal, actorUserId, balance, StockMovementKind.RELEASE_RESERVATION);
  }

  const isTaskVisible = task.version > 0;
  applyWarehouseEquipmentOperation(transaction, runtime, tenantId, task, 'cancel');
  task.status = PickingTaskStatus.CANCELLED;
  task.version += Number(isTaskVisible);
  saveOutboundTask(transaction, runtime, task, tenantId, isTaskVisible);
  publishStockAvailabilityChanged(transaction, runtime, task.warehouseId, tenantId);
};
