import type {
  Listing,
  WarehouseAvailability,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import { StockStatus } from '@skladburg/contracts/wms/v1/stock';

import type { CalendarDateValue } from '../../calendar/index';
import type { IStateReader } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  compareCalendarDates,
  toCalendarDate,
} from '../../calendar/index';
import { MAX_CATALOG_QUANTITY } from '../catalog/catalogRules';
import { readStockBalance } from './stockRecords';

interface AvailableUnitValue {
  expiresOn: CalendarDateValue | undefined;
  productId: string;
  quantity: bigint;
}

export const describeAvailableUnit = (balance: StockBalance, date: CalendarDateValue): AvailableUnitValue | undefined => {
  const productId = balance.lines[0]?.batch?.productId;
  if (productId === undefined || balance.receivingAreaId !== undefined) {
    return undefined;
  }

  let quantity = 0n;
  let expiresOn: CalendarDateValue | undefined;
  for (const line of balance.lines) {
    if (line.status !== StockStatus.AVAILABLE || line.batch?.productId !== productId || line.quantityBase <= 0n) {
      return undefined;
    }
    const expiration = line.batch.expiresOn;
    if (expiration !== undefined) {
      if (compareCalendarDates(expiration, date) < 0) {
        return undefined;
      }
      if (expiresOn === undefined || compareCalendarDates(expiration, expiresOn) < 0) {
        expiresOn = expiration;
      }
    }
    quantity += line.quantityBase;
  }

  return { expiresOn, productId, quantity };
};

export const createOutboundAvailability = (
  runtime: IModuleRuntime,
  reader: IStateReader,
): ((listing: Listing) => readonly WarehouseAvailability[]) => {
  const warehouses = new Map<string, Map<string, bigint>>();
  const quantities = (warehouseId: string, tenantId: string): ReadonlyMap<string, bigint> => {
    const warehouse = reader.get('warehouses', warehouseId);
    if (warehouse?.tenantId !== tenantId) {
      return new Map();
    }
    const current = warehouses.get(warehouseId);
    if (current !== undefined) {
      return current;
    }
    const next = new Map<string, bigint>();
    const date = toCalendarDate(runtime.getWorldTimeMs(), warehouse.timeZone);
    for (const record of reader.listBy('stockBalances', 'scopeId', warehouseId)) {
      const unit = describeAvailableUnit(readStockBalance(record, tenantId, runtime.errors), date);
      if (unit !== undefined) {
        next.set(unit.productId, (next.get(unit.productId) ?? 0n) + unit.quantity);
      }
    }
    warehouses.set(warehouseId, next);
    return next;
  };

  return (listing) => {
    if (runtime.wmsOutboundWarehouseIds === undefined) {
      return listing.availability;
    }
    return listing.availability.flatMap((entry) => {
      if (!runtime.wmsOutboundWarehouseIds?.has(entry.warehouseId)) {
        return [entry];
      }
      const quantity = quantities(entry.warehouseId, listing.tenantId).get(listing.productId) ?? 0n;
      if (quantity === 0n) {
        return [];
      }
      return [{
        ...entry,
        quantity: quantity > MAX_CATALOG_QUANTITY ? MAX_CATALOG_QUANTITY : quantity,
        status: quantity < listing.minOrderQuantity ? AvailabilityStatus.LOW : AvailabilityStatus.IN_STOCK,
      }];
    });
  };
};
