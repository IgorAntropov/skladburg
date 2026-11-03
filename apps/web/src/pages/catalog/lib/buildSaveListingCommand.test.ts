import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  ListingFormOutputValue,
  StockRowOutputValue,
} from './listingFormValues';

import {
  buildSaveListingCommand,
  collectShippedRowIndexes,
  remapAvailabilityPath,
} from './buildSaveListingCommand';

const MOSCOW = 'a0000001-0000-4000-8000-000000000001';
const KAZAN = 'a0000001-0000-4000-8000-000000000002';
const TVER = 'a0000001-0000-4000-8000-000000000003';

const row = (warehouseId: string, status: AvailabilityStatus, quantity?: bigint): StockRowOutputValue => ({
  quantity,
  status,
  warehouseId,
});

const createValues = (availability: StockRowOutputValue[]): ListingFormOutputValue => ({
  availability,
  minOrderQuantity: 480000n,
  orderStep: 1000n,
  priceUnit: { baseQuantity: 1000n, name: 'кг' },
});

describe('command of the listing', () => {
  it('leaves out the warehouses that are not shipped from and keeps the order of the rest', () => {
    const values = createValues([
      row(MOSCOW, AvailabilityStatus.IN_STOCK, 900000n),
      row(KAZAN, AvailabilityStatus.UNSPECIFIED),
      row(TVER, AvailabilityStatus.ON_ORDER),
    ]);

    const command = buildSaveListingCommand(values, { isUnitLocked: false, savedUnit: undefined });

    expect(command.availability).toEqual([
      { quantity: 900000n, status: AvailabilityStatus.IN_STOCK, warehouseId: MOSCOW },
      { quantity: 0n, status: AvailabilityStatus.ON_ORDER, warehouseId: TVER },
    ]);
  });

  it('sends the unit of the form while the price does not hold it', () => {
    const command = buildSaveListingCommand(createValues([]), {
      isUnitLocked: false,
      savedUnit: { $typeName: 'catalog.v1.PriceUnit', baseQuantity: 1n, name: 'г' },
    });

    expect(command.priceUnit).toEqual({ baseQuantity: 1000n, name: 'кг' });
  });

  it('sends the saved unit when the price holds it, whatever the form says', () => {
    const command = buildSaveListingCommand(createValues([]), {
      isUnitLocked: true,
      savedUnit: { $typeName: 'catalog.v1.PriceUnit', baseQuantity: 1n, name: 'г' },
    });

    expect(command.priceUnit).toEqual({ baseQuantity: 1n, name: 'г' });
  });

  it('sends the unit of the form when it is locked but the listing has no saved unit', () => {
    const command = buildSaveListingCommand(createValues([]), { isUnitLocked: true, savedUnit: undefined });

    expect(command.priceUnit).toEqual({ baseQuantity: 1000n, name: 'кг' });
  });
});

describe('index of the warehouse in the violations of the server', () => {
  const values = createValues([
    row(MOSCOW, AvailabilityStatus.UNSPECIFIED),
    row(KAZAN, AvailabilityStatus.LOW, 0n),
    row(TVER, AvailabilityStatus.IN_STOCK, 5000n),
  ]);

  it('lists the rows that go into the command', () => {
    expect(collectShippedRowIndexes(values.availability)).toEqual([1, 2]);
  });

  it('moves availability[1] of the command to the row of the third warehouse', () => {
    expect(remapAvailabilityPath('availability[1].quantity', values)).toBe('availability[2].quantity');
  });

  it('moves availability[0] of the command to the row of the second warehouse', () => {
    expect(remapAvailabilityPath('availability[0].warehouse_id', values)).toBe('availability[1].warehouse_id');
  });

  it('keeps the paths that are not about the availability', () => {
    expect(remapAvailabilityPath('price_unit.base_quantity', values)).toBe('price_unit.base_quantity');
    expect(remapAvailabilityPath('availability', values)).toBe('availability');
  });

  it('keeps the path of an index the command does not have', () => {
    expect(remapAvailabilityPath('availability[7].quantity', values)).toBe('availability[7].quantity');
  });
});
