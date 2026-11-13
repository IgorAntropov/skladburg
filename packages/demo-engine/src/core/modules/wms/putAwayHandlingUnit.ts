import type {
  PutAwayHandlingUnitRequest,
  ReceivingTask,
} from '@skladburg/contracts/wms/v1/receiving';

import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';
import { StockMovementKind } from '@skladburg/contracts/wms/v1/stock';

import type { PermissionCallerValue } from '../../access/index';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { toCalendarDate } from '../../calendar/index';
import { describeAvailableUnit } from './outboundAvailability';
import { requireStockCells } from './stockLocations';
import {
  publishStockAvailabilityChanged,
  readStockBalance,
  recordStockMovement,
} from './stockRecords';

export const putAwayHandlingUnit = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  caller: PermissionCallerValue,
  task: ReceivingTask,
  request: PutAwayHandlingUnitRequest,
): void => {
  const { errors } = runtime;
  const { handlingUnitId, toCellId, warehouseId } = request;
  const fact = task.receivedUnits.find(unit => unit.balanceAtReceipt?.handlingUnit?.id === handlingUnitId);
  const record = transaction.get('stockBalances', handlingUnitId);
  if (fact === undefined || record?.scopeId !== warehouseId) {
    throw errors.notFound(EntityKind.HANDLING_UNIT);
  }
  if (fact.putAwayCellId !== undefined) {
    throw errors.invalidTransition(EntityKind.HANDLING_UNIT, 'STORED', 'PUT_AWAY');
  }
  const balance = readStockBalance(record, caller.organizationId, errors);
  const { handlingUnit, receivingAreaId } = balance;
  const original = fact.balanceAtReceipt?.handlingUnit;
  if (receivingAreaId !== task.receivingAreaId || handlingUnit === undefined || original === undefined || balance.lines.length === 0
    || handlingUnit.sscc !== original.sscc || handlingUnit.version >= 2_147_483_647
    || (handlingUnit.version !== original.version
      && (task.status !== ReceivingTaskStatus.RECONCILED || handlingUnit.version !== original.version + 1))) {
    throw errors.internal();
  }
  requireStockCells(transaction, errors, warehouseId, caller.organizationId, toCellId);

  balance.receivingAreaId = undefined;
  balance.cellId = toCellId;
  handlingUnit.version += 1;
  const warehouse = transaction.get('warehouses', warehouseId);
  const hasAvailableUnit = warehouse?.tenantId === caller.organizationId
    && describeAvailableUnit(balance, toCalendarDate(transaction.worldTimeMs, warehouse.timeZone)) !== undefined;
  recordStockMovement(transaction, runtime, caller.user.id, balance, {
    dealId: task.dealId,
    fromCellId: undefined,
    fromReceivingAreaId: receivingAreaId,
    isEventDeferred: hasAvailableUnit,
    kind: StockMovementKind.TRANSFER,
    sourceDocumentNumber: task.sourceDocumentNumber,
  });

  if (hasAvailableUnit) {
    publishStockAvailabilityChanged(transaction, runtime, warehouseId, caller.organizationId);
  }

  fact.putAwayAt = timestampFromMs(transaction.worldTimeMs);
  fact.putAwayCellId = toCellId;
};
