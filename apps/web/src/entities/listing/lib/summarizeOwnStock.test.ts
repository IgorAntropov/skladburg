import type { WarehouseAvailability } from '@skladburg/contracts/catalog/v1/catalog';

import { create } from '@bufbuild/protobuf';
import {
  AvailabilityStatus,
  WarehouseAvailabilitySchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { summarizeOwnStock } from './summarizeOwnStock';

const createEntry = (status: AvailabilityStatus, quantity: bigint): WarehouseAvailability => (
  create(WarehouseAvailabilitySchema, { quantity, status })
);

describe('summarizeOwnStock', () => {
  it('says that no warehouses are listed', () => {
    expect(summarizeOwnStock([])).toEqual({ kind: 'none' });
  });

  it('says that the position ships to order only while every warehouse is empty', () => {
    expect(summarizeOwnStock([createEntry(AvailabilityStatus.ON_ORDER, 0n), createEntry(AvailabilityStatus.ON_ORDER, 0n)]))
      .toEqual({ kind: 'order-only' });
  });

  it('adds the quantities and counts only the warehouses that hold stock', () => {
    const summary = summarizeOwnStock([
      createEntry(AvailabilityStatus.IN_STOCK, 12_000n),
      createEntry(AvailabilityStatus.ON_ORDER, 0n),
      createEntry(AvailabilityStatus.IN_STOCK, 5_280n),
    ]);

    expect(summary).toEqual({ hasLow: false, kind: 'stock', quantity: 17_280n, warehouseCount: 2 });
  });

  it('flags a warehouse where the stock is low', () => {
    const summary = summarizeOwnStock([
      createEntry(AvailabilityStatus.IN_STOCK, 900n),
      createEntry(AvailabilityStatus.LOW, 100n),
    ]);

    expect(summary).toMatchObject({ hasLow: true, kind: 'stock', quantity: 1_000n });
  });

  it('keeps big stocks exact beyond the safe integer range', () => {
    const summary = summarizeOwnStock([
      createEntry(AvailabilityStatus.IN_STOCK, 9_007_199_254_740_993n),
      createEntry(AvailabilityStatus.IN_STOCK, 2n),
    ]);

    expect(summary).toMatchObject({ quantity: 9_007_199_254_740_995n });
  });
});
