import type {
  Deal,
  DealLine,
} from '@skladburg/contracts/deal/v1/deal';
import type {
  StockBalance,
  StockMovementKind as StockMovementKindValue,
} from '@skladburg/contracts/wms/v1/stock';

import {
  clone,
  create,
  equals,
} from '@bufbuild/protobuf';
import {
  PickingTaskSchema,
  PickingTaskStatus,
} from '@skladburg/contracts/wms/v1/picking';
import {
  StockBalanceSchema,
  StockMovementKind,
  StockStatus,
} from '@skladburg/contracts/wms/v1/stock';

import type { CalendarDateValue } from '../../calendar/index';
import type {
  IStateReader,
  IStateTransaction,
} from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  compareCalendarDates,
  toCalendarDate,
} from '../../calendar/index';
import { compareIds } from '../../state/index';
import { failDealValidation } from '../deals/dealRules';
import { describeAvailableUnit } from './outboundAvailability';
import {
  readOutboundTask,
  saveOutboundTask,
} from './outboundRecords';
import { selectWholeUnits } from './outboundSelection';
import {
  publishStockAvailabilityChanged,
  readStockBalance,
  recordStockMovement,
} from './stockRecords';

interface UnitCandidateValue {
  balance: StockBalance;
  expiresOn: CalendarDateValue | undefined;
  id: string;
  quantity: bigint;
}

const compareCandidates = (current: UnitCandidateValue, prev: UnitCandidateValue): number => {
  if (current.expiresOn !== undefined && prev.expiresOn !== undefined) {
    return compareCalendarDates(current.expiresOn, prev.expiresOn) || compareIds(current.id, prev.id);
  }
  return Number(current.expiresOn === undefined) - Number(prev.expiresOn === undefined) || compareIds(current.id, prev.id);
};

export const applyOutboundMovement = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  deal: Deal,
  actorUserId: string,
  current: StockBalance,
  kind: StockMovementKindValue,
): StockBalance => {
  const next = clone(StockBalanceSchema, current);
  if (next.handlingUnit === undefined || next.handlingUnit.version >= 2_147_483_647) {
    throw runtime.errors.internal();
  }

  next.handlingUnit.version += 1;
  const isShipment = kind === StockMovementKind.SHIPMENT;
  if (isShipment) {
    next.cellId = '';
    next.lines = [];
  }
  else {
    for (const line of next.lines) {
      line.status = kind === StockMovementKind.RESERVE ? StockStatus.RESERVED : StockStatus.AVAILABLE;
    }
  }

  recordStockMovement(transaction, runtime, actorUserId, next, {
    dealId: deal.id,
    fromCellId: current.cellId,
    isEventDeferred: true,
    kind,
    lines: isShipment ? current.lines : undefined,
    sourceDocumentNumber: String(deal.number),
  });
  return next;
};

export type OutboundDemandLineValue = Pick<DealLine, 'listingId' | 'quantity'>;

type OutboundPlanValue
  = | { balances: StockBalance[]; kind: 'ready' }
    | { index: number; kind: 'missing' }
    | { kind: 'unavailable' };

export const planOutboundStock = (
  reader: IStateReader,
  runtime: IModuleRuntime,
  deal: Pick<Deal, 'desiredDate' | 'supplierOrganizationId'>,
  warehouseId: string,
  lines: readonly OutboundDemandLineValue[],
  worldTimeMs: number,
): OutboundPlanValue => {
  const { desiredDate, supplierOrganizationId: tenantId } = deal;
  const warehouse = reader.get('warehouses', warehouseId);
  if (warehouse?.tenantId !== tenantId || desiredDate === undefined) {
    throw runtime.errors.internal();
  }

  const today = toCalendarDate(worldTimeMs, warehouse.timeZone);
  const date = compareCalendarDates(today, desiredDate) > 0 ? today : desiredDate;
  const demands = new Map<string, { index: number; quantity: bigint }>();
  for (const [index, line] of lines.entries()) {
    const listing = reader.get('listings', line.listingId);
    if (listing?.tenantId !== tenantId) {
      throw runtime.errors.internal();
    }
    const current = demands.get(listing.productId);
    demands.set(listing.productId, { index: current?.index ?? index, quantity: (current?.quantity ?? 0n) + line.quantity });
  }

  const candidates = new Map<string, UnitCandidateValue[]>();
  for (const record of reader.listBy('stockBalances', 'scopeId', warehouseId)) {
    const balance = readStockBalance(record, tenantId, runtime.errors);
    const unit = describeAvailableUnit(balance, date);
    if (unit !== undefined && demands.has(unit.productId)) {
      const units = candidates.get(unit.productId) ?? [];
      units.push({ balance, expiresOn: unit.expiresOn, id: record.id, quantity: unit.quantity });
      candidates.set(unit.productId, units);
    }
  }

  const selected: StockBalance[] = [];
  for (const [productId, demand] of demands) {
    const units = (candidates.get(productId) ?? []).sort(compareCandidates);
    const selection = selectWholeUnits(units.map(unit => unit.quantity), demand.quantity);
    if (selection === null) {
      return { kind: 'unavailable' };
    }
    if (selection === undefined) {
      return { index: demand.index, kind: 'missing' };
    }

    for (const index of selection) {
      const unit = units[index];
      if (unit === undefined) {
        throw runtime.errors.internal();
      }
      selected.push(unit.balance);
    }
  }

  return { balances: selected, kind: 'ready' };
};

export const reserveOutboundStock = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  deal: Deal,
  actorUserId: string,
): void => {
  const warehouseId = deal.shipFromWarehouseId;
  if (!runtime.wmsOutboundWarehouseIds?.has(warehouseId)) {
    return;
  }
  if (transaction.get('warehouseOutbound', deal.id) !== undefined) {
    throw runtime.errors.internal();
  }

  const tenantId = deal.supplierOrganizationId;
  const plan = planOutboundStock(transaction, runtime, deal, warehouseId, deal.lines, transaction.worldTimeMs);
  if (plan.kind === 'unavailable') {
    throw runtime.errors.unavailable();
  }
  if (plan.kind === 'missing') {
    return failDealValidation(runtime.errors, `lines[${String(plan.index)}].quantity`, 'deal.quantity.unavailable');
  }
  const selected = plan.balances;
  const units = selected.map(balance => applyOutboundMovement(transaction, runtime, deal, actorUserId, balance, StockMovementKind.RESERVE));
  saveOutboundTask(transaction, runtime, create(PickingTaskSchema, { dealId: deal.id, id: deal.id, units, warehouseId }), tenantId, false);
  publishStockAvailabilityChanged(transaction, runtime, warehouseId, tenantId);
};

export const readReservedUnits = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  units: readonly StockBalance[],
  warehouseId: string,
  tenantId: string,
): StockBalance[] => units.map((reserved) => {
  const record = transaction.get('stockBalances', reserved.handlingUnit?.id ?? '');
  if (record?.scopeId !== warehouseId) {
    throw runtime.errors.internal();
  }
  const balance = readStockBalance(record, tenantId, runtime.errors);
  if (!equals(StockBalanceSchema, balance, reserved)) {
    throw runtime.errors.internal();
  }
  return balance;
});

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
  task.status = PickingTaskStatus.CANCELLED;
  task.version += Number(isTaskVisible);
  saveOutboundTask(transaction, runtime, task, tenantId, isTaskVisible);
  publishStockAvailabilityChanged(transaction, runtime, task.warehouseId, tenantId);
};
