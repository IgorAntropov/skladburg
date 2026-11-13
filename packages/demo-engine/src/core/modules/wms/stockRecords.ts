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
  type StockLine,
  type StockMovement,
  type StockMovementKind,
  StockMovementSchema,
} from '@skladburg/contracts/wms/v1/stock';
import { StockChangedSchema } from '@skladburg/contracts/wms/v1/stock_events';

import type { IDomainErrors } from '../../errors/index';
import type { IStateTransaction } from '../../state/index';
import type { WarehouseStockRecordValue } from '../../state/records';
import type {
  IEventOutbox,
  IModuleRuntime,
} from '../moduleRuntime';

import { createCatalogChangePublisher } from '../catalog/catalogEvents';

export const buildSsccKey = (tenantId: string, sscc: string): string => JSON.stringify([tenantId, sscc]);

export const readStockBalance = (
  record: WarehouseStockRecordValue,
  tenantId: string,
  errors: IDomainErrors,
): StockBalance => {
  const balance = fromBinary(StockBalanceSchema, record.bytes);
  const { handlingUnit } = balance;

  if (handlingUnit?.id !== record.id || handlingUnit.tenantId !== tenantId
    || handlingUnit.warehouseId !== record.scopeId || record.lookupKey !== buildSsccKey(tenantId, handlingUnit.sscc)
    || (balance.receivingAreaId !== undefined && balance.cellId !== '')) {
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
  dealId?: string | undefined;
  fromCellId: string | undefined;
  fromReceivingAreaId?: string | undefined;
  isEventDeferred?: boolean | undefined;
  kind: StockMovementKind;
  lines?: StockLine[] | undefined;
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
  runtime: Pick<IModuleRuntime, 'errors' | 'outbox' | 'random'>,
  actorUserId: string,
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
  const { isEventDeferred, lines, ...movementBasis } = basis;
  const occurredAt = timestampFromMs(transaction.worldTimeMs);
  const movement = create(StockMovementSchema, {
    ...movementBasis,
    actorUserId,
    handlingUnit,
    id,
    lines: lines ?? balance.lines,
    occurredAt,
    tenantId: handlingUnit.tenantId,
    toCellId: balance.cellId,
    toReceivingAreaId: balance.receivingAreaId,
    warehouseId,
  });

  transaction.put('stockBalances', {
    bytes: toBinary(StockBalanceSchema, balance),
    id: handlingUnit.id,
    lookupKey: buildSsccKey(handlingUnit.tenantId, handlingUnit.sscc),
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

export const publishStockAvailabilityChanged = (
  transaction: IStateTransaction,
  runtime: Pick<IModuleRuntime, 'outbox' | 'wmsOutboundWarehouseIds'>,
  warehouseId: string,
  tenantId: string,
): void => {
  publishStockChanged(transaction, runtime.outbox, warehouseId);
  if (runtime.wmsOutboundWarehouseIds?.has(warehouseId) === true) {
    createCatalogChangePublisher(runtime.outbox)(transaction, tenantId, true);
  }
};
