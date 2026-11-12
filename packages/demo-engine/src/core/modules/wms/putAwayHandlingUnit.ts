import type {
  PutAwayHandlingUnitRequest,
  ReceivingTask,
} from '@skladburg/contracts/wms/v1/receiving';

import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { StockMovementKind } from '@skladburg/contracts/wms/v1/stock';

import type { PermissionCallerValue } from '../../access/index';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { requireStockCells } from './stockLocations';
import {
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
  if (receivingAreaId !== task.receivingAreaId || handlingUnit === undefined || balance.lines.length === 0
    || handlingUnit.version !== fact.balanceAtReceipt?.handlingUnit?.version || handlingUnit.version >= 2_147_483_647) {
    throw errors.internal();
  }
  requireStockCells(transaction, errors, warehouseId, caller.organizationId, toCellId);

  balance.receivingAreaId = undefined;
  balance.cellId = toCellId;
  handlingUnit.version += 1;
  recordStockMovement(transaction, runtime, caller.user.id, balance, {
    dealId: task.dealId,
    fromCellId: undefined,
    fromReceivingAreaId: receivingAreaId,
    kind: StockMovementKind.TRANSFER,
    sourceDocumentNumber: task.sourceDocumentNumber,
  });

  fact.putAwayAt = timestampFromMs(transaction.worldTimeMs);
  fact.putAwayCellId = toCellId;
};
