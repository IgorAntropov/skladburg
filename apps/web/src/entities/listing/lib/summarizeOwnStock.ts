import type { WarehouseAvailability } from '@skladburg/contracts/catalog/v1/catalog';

import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';

export type OwnStockSummaryValue
  = | { hasLow: boolean; kind: 'stock'; quantity: bigint; warehouseCount: number }
    | { kind: 'none' }
    | { kind: 'order-only' };

const NO_STOCK: OwnStockSummaryValue = { kind: 'none' };
const ORDER_ONLY_STOCK: OwnStockSummaryValue = { kind: 'order-only' };

export const summarizeOwnStock = (availability: readonly WarehouseAvailability[]): OwnStockSummaryValue => {
  if (availability.length === 0) {
    return NO_STOCK;
  }

  const stocked = availability.filter(entry => entry.quantity > 0n);

  if (stocked.length === 0) {
    return ORDER_ONLY_STOCK;
  }

  return {
    hasLow: availability.some(entry => entry.status === AvailabilityStatus.LOW),
    kind: 'stock',
    quantity: stocked.reduce((total, entry) => total + entry.quantity, 0n),
    warehouseCount: stocked.length,
  };
};
