import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ModuleHarnessValue } from '../../testing/moduleHarness';

import { SeedWarehouseId } from '../../../seed/index';
import { createModuleHarness } from '../../testing/moduleHarness';
import {
  MAX_CATALOG_QUANTITY,
  QUANTITY_ABOVE_LIMIT_RULE_ID,
  QUANTITY_BELOW_MINIMUM_RULE_ID,
  QUANTITY_NOT_MULTIPLE_OF_STEP_RULE_ID,
} from '../catalogRules';
import {
  captureFailure,
  SUPPLIER_1_CALL,
} from '../testing/catalogFixtures';
import {
  createShowcaseListing,
  CUSTOMER_CALL,
  CUSTOMER_WAREHOUSE_ID,
  saveSalesTerms,
  UNKNOWN_ID,
} from './testing/showcaseFixtures';

const createPickupListing = async (harness: ModuleHarnessValue): Promise<string> => {
  await saveSalesTerms(harness, SUPPLIER_1_CALL, { preparationWorkingDays: 1 });

  const { listing } = await createShowcaseListing(harness);

  return listing.id;
};

describe('GetShowcaseListing quantity', () => {
  it('quotes the minimum quantity when the quantity is zero', async () => {
    const harness = createModuleHarness();
    const listingId = await createPickupListing(harness);

    const response = await harness.catalogShowcase.getShowcaseListing(
      { listingId, quantity: 0n, toWarehouseId: CUSTOMER_WAREHOUSE_ID },
      CUSTOMER_CALL,
    );
    const [quote] = response.listing?.quotes ?? [];

    expect(response.listing?.minOrderQuantity).toBe(10n);
    expect(quote?.quantity).toBe(10n);
    expect(quote?.unitPrice?.amountMinor).toBe(9000n);
    expect(quote?.goodsTotal?.amountMinor).toBe(90_000n);
  });

  it.each([
    { goodsTotal: 90_000n, quantity: 10n, unitPrice: 9000n },
    { goodsTotal: 855_000n, quantity: 95n, unitPrice: 9000n },
    { goodsTotal: 850_000n, quantity: 100n, unitPrice: 8500n },
    { goodsTotal: 1_275_000n, quantity: 150n, unitPrice: 8500n },
  ])('takes the tier by the quantity $quantity', async ({ goodsTotal, quantity, unitPrice }) => {
    const harness = createModuleHarness();
    const listingId = await createPickupListing(harness);

    const response = await harness.catalogShowcase.getShowcaseListing(
      { listingId, quantity, toWarehouseId: CUSTOMER_WAREHOUSE_ID },
      CUSTOMER_CALL,
    );
    const [quote] = response.listing?.quotes ?? [];

    expect(quote?.quantity).toBe(quantity);
    expect(quote?.unitPrice?.amountMinor).toBe(unitPrice);
    expect(quote?.goodsTotal?.amountMinor).toBe(goodsTotal);
  });

  it.each([
    { quantity: 5n, ruleId: QUANTITY_BELOW_MINIMUM_RULE_ID },
    { quantity: 12n, ruleId: QUANTITY_NOT_MULTIPLE_OF_STEP_RULE_ID },
    { quantity: MAX_CATALOG_QUANTITY + 5n, ruleId: QUANTITY_ABOVE_LIMIT_RULE_ID },
  ])('rejects the quantity $quantity with $ruleId', async ({ quantity, ruleId }) => {
    const harness = createModuleHarness();
    const listingId = await createPickupListing(harness);

    const failure = await captureFailure(harness.catalogShowcase.getShowcaseListing({ listingId, quantity }, CUSTOMER_CALL));

    expect(failure.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(failure.violations).toEqual([{ fieldPath: 'quantity', ruleId }]);
  });

  it('checks the quantity without a destination warehouse and with one', async () => {
    const harness = createModuleHarness();
    const listingId = await createPickupListing(harness);

    const withoutWarehouse = await captureFailure(harness.catalogShowcase.getShowcaseListing({ listingId, quantity: 5n }, CUSTOMER_CALL));
    const withWarehouse = await captureFailure(
      harness.catalogShowcase.getShowcaseListing({ listingId, quantity: 5n, toWarehouseId: CUSTOMER_WAREHOUSE_ID }, CUSTOMER_CALL),
    );

    expect(withoutWarehouse.violations).toEqual(withWarehouse.violations);
    expect(withoutWarehouse.violations).toHaveLength(1);
  });

  it('answers not_found for a listing the customer cannot see before it looks at the quantity', async () => {
    const harness = createModuleHarness();
    const { listing } = await createShowcaseListing(harness, { isDraft: true });

    const draft = await captureFailure(
      harness.catalogShowcase.getShowcaseListing({ listingId: listing.id, quantity: 5n }, CUSTOMER_CALL),
    );
    const unknown = await captureFailure(
      harness.catalogShowcase.getShowcaseListing({ listingId: UNKNOWN_ID, quantity: 5n }, CUSTOMER_CALL),
    );

    for (const failure of [draft, unknown]) {
      expect(failure.code).toBe(ErrorCode.NOT_FOUND);
      expect(failure.entity).toBe(EntityKind.LISTING);
    }
  });

  it('looks at the destination warehouse before the listing', async () => {
    const harness = createModuleHarness();

    const failure = await captureFailure(harness.catalogShowcase.getShowcaseListing(
      { listingId: UNKNOWN_ID, toWarehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1 },
      CUSTOMER_CALL,
    ));

    expect(failure.entity).toBe(EntityKind.WAREHOUSE);
  });
});
