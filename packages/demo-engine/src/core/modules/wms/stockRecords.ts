import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  timestampFromMs,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import { inventoryChannel } from '@skladburg/contracts/runtime';
import {
  type StockBalance,
  StockBalanceSchema,
  type StockMovement,
  type StockMovementKind,
  StockMovementSchema,
} from '@skladburg/contracts/wms/v1/stock';
import { StockChangedSchema } from '@skladburg/contracts/wms/v1/stock_events';

import type { PermissionCallerValue } from '../../access/index';
import type { IDomainErrors } from '../../errors/index';
import type { IStateTransaction } from '../../state/index';
import type { WarehouseStockRecordValue } from '../../state/records';
import type {
  IEventOutbox,
  IModuleRuntime,
} from '../moduleRuntime';

export const buildSsccKey = (tenantId: string, sscc: string): string => JSON.stringify([tenantId, sscc]);

export const readStockBalance = (
  record: WarehouseStockRecordValue,
  tenantId: string,
  errors: IDomainErrors,
): StockBalance => {
  const balance = fromBinary(StockBalanceSchema, record.bytes);
  const { handlingUnit } = balance;

  if (handlingUnit?.id !== record.id || handlingUnit.tenantId !== tenantId
    || handlingUnit.warehouseId !== record.scopeId || record.lookupKey !== buildSsccKey(tenantId, handlingUnit.sscc)) {
    throw errors.internal();
  }

  return balance;
};

export const readStockMovement = (
  record: WarehouseStockRecordValue,
  tenantId: string,
  errors: IDomainErrors,
): StockMovement => {
  const movement = fromBinary(StockMovementSchema, record.bytes);

  if (movement.id !== record.id || movement.tenantId !== tenantId || movement.warehouseId !== record.scopeId
    || movement.occurredAt === undefined || String(timestampMs(movement.occurredAt)) !== record.lookupKey) {
    throw errors.internal();
  }

  return movement;
};

interface MovementBasisValue {
  fromCellId: string | undefined;
  isEventDeferred?: boolean | undefined;
  kind: StockMovementKind;
  sourceDocumentNumber: string;
}

export const publishStockChanged = (transaction: IStateTransaction, outbox: IEventOutbox, warehouseId: string): void => {
  outbox.add(transaction, inventoryChannel(warehouseId), {
    case: 'stockChanged',
    value: create(StockChangedSchema, { warehouseId }),
  });
};

export const recordStockMovement = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  caller: PermissionCallerValue,
  balance: StockBalance,
  basis: MovementBasisValue,
): StockMovement => {
  const { errors, outbox, random } = runtime;
  const { handlingUnit } = balance;
  const id = random.uuid();

  if (handlingUnit === undefined || transaction.get('stockMovements', id) !== undefined) {
    throw errors.internal();
  }

  const { warehouseId } = handlingUnit;
  const { isEventDeferred, ...movementBasis } = basis;
  const occurredAt = timestampFromMs(transaction.worldTimeMs);
  const movement = create(StockMovementSchema, {
    ...movementBasis,
    actorUserId: caller.user.id,
    handlingUnit,
    id,
    lines: balance.lines,
    occurredAt,
    tenantId: caller.organizationId,
    toCellId: balance.cellId,
    warehouseId,
  });

  transaction.put('stockBalances', {
    bytes: toBinary(StockBalanceSchema, balance),
    id: handlingUnit.id,
    lookupKey: buildSsccKey(caller.organizationId, handlingUnit.sscc),
    scopeId: warehouseId,
  });
  transaction.put('stockMovements', {
    bytes: toBinary(StockMovementSchema, movement),
    id,
    lookupKey: String(timestampMs(occurredAt)),
    scopeId: warehouseId,
  });
  if (isEventDeferred !== true) {
    publishStockChanged(transaction, outbox, warehouseId);
  }

  return movement;
};
