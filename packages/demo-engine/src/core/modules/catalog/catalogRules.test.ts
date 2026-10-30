import type {
  Packaging,
  PriceTier,
  WarehouseAvailability,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { Money } from '@skladburg/contracts/common/v1/money';

import { create } from '@bufbuild/protobuf';
import {
  AvailabilityStatus,
  BaseUnit,
  OwnDeliveryTermsSchema,
  PackagingSchema,
  PriceTierSchema,
  TemperatureRangeSchema,
  WarehouseAvailabilitySchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  ListingPriceRulesInputValue,
  ListingRulesInputValue,
  ProductRulesInputValue,
} from './catalogRules';

import {
  AVAILABILITY_QUANTITY_REQUIRED_RULE_ID,
  BASE_UNIT_LOCKED_RULE_ID,
  collectListingPriceViolations,
  collectListingViolations,
  collectProductViolations,
  collectPublicationViolations,
  collectSalesTermsViolations,
  collectTierAmounts,
  CURRENCY_UNSUPPORTED_RULE_ID,
  GTIN_TAKEN_RULE_ID,
  LISTING_PRICE_REQUIRED_RULE_ID,
  LISTING_PRODUCT_LOCKED_RULE_ID,
  LISTING_PRODUCT_TAKEN_RULE_ID,
  LISTING_WAREHOUSE_REQUIRED_RULE_ID,
  MIN_ORDER_NOT_MULTIPLE_OF_STEP_RULE_ID,
  MIN_PRICE_ABOVE_TIER_RULE_ID,
  PACKAGING_ID_DUPLICATE_RULE_ID,
  PRICE_BELOW_MINIMUM_RULE_ID,
  PRICE_UNIT_LOCKED_RULE_ID,
  SKU_TAKEN_RULE_ID,
  SPHERE_EXISTS_RULE_ID,
  TEMPERATURE_RANGE_ORDER_RULE_ID,
  TIER_ABOVE_MINIMUM_ORDER_RULE_ID,
  TIER_ORDER_RULE_ID,
  WAREHOUSE_DUPLICATE_RULE_ID,
  WAREHOUSE_EXISTS_RULE_ID,
} from './catalogRules';

const WAREHOUSE_A = '81000000-0000-4000-8000-000000000001';
const WAREHOUSE_B = '81000000-0000-4000-8000-000000000002';
const SPHERE_A = '51000000-0000-4000-8000-000000000001';
const PRODUCT_A = '71000000-0000-4000-8000-000000000001';
const PRODUCT_B = '71000000-0000-4000-8000-000000000002';
const PACKAGING_ID = '61000000-0000-4000-8000-000000000001';

const rub = (amountMinor: bigint): Money => create(MoneySchema, { amountMinor, currencyCode: 'RUB' });
const tier = (minQuantity: bigint, amountMinor: bigint): PriceTier =>
  create(PriceTierSchema, { minQuantity, price: rub(amountMinor) });
const packaging = (id: string): Packaging => create(PackagingSchema, { id });

const entry = (warehouseId: string, status: AvailabilityStatus, quantity: bigint): WarehouseAvailability =>
  create(WarehouseAvailabilitySchema, { quantity, status, warehouseId });

type RuleCaseTupleValue<TInput> = [name: string, overrides: Partial<TInput>, fieldPath: string, ruleId: string];

const buildProductInput = (overrides: Partial<ProductRulesInputValue> = {}): ProductRulesInputValue => ({
  baseUnit: BaseUnit.PIECE,
  baseUnitLock: undefined,
  gtin: '',
  minPrice: undefined,
  packagings: [packaging(PACKAGING_ID)],
  sku: 'A-1',
  storageTemperature: undefined,
  takenGtins: new Set(),
  takenSkus: new Set(),
  tierAmounts: [],
  ...overrides,
});

const buildListingInput = (overrides: Partial<ListingRulesInputValue> = {}): ListingRulesInputValue => ({
  availability: [entry(WAREHOUSE_A, AvailabilityStatus.IN_STOCK, 5n)],
  baseQuantity: 1n,
  existingFirstTierMinQuantity: undefined,
  isProductTaken: false,
  isPublished: false,
  knownSphereIds: new Set([SPHERE_A]),
  minOrderQuantity: 10n,
  orderStep: 5n,
  ownWarehouseIds: new Set([WAREHOUSE_A, WAREHOUSE_B]),
  priceLock: undefined,
  productId: PRODUCT_A,
  sphereIds: [SPHERE_A],
  ...overrides,
});

const buildPriceInput = (overrides: Partial<ListingPriceRulesInputValue> = {}): ListingPriceRulesInputValue => ({
  minOrderQuantity: 10n,
  productMinPrice: undefined,
  tiers: [tier(10n, 9000n), tier(100n, 8500n)],
  ...overrides,
});

describe('collectProductViolations', () => {
  it('accepts a valid product', () => {
    expect(collectProductViolations(buildProductInput())).toEqual([]);
  });

  const cases: RuleCaseTupleValue<ProductRulesInputValue>[] = [
    ['sku taken', { takenSkus: new Set(['A-1']) }, 'sku', SKU_TAKEN_RULE_ID],
    ['gtin taken', { gtin: '2000000000015', takenGtins: new Set(['2000000000015']) }, 'gtin', GTIN_TAKEN_RULE_ID],
    [
      'duplicate packaging id',
      { packagings: [packaging(PACKAGING_ID), packaging('other'), packaging(PACKAGING_ID)] },
      'packagings[2].id',
      PACKAGING_ID_DUPLICATE_RULE_ID,
    ],
    [
      'temperature range reversed',
      { storageTemperature: create(TemperatureRangeSchema, { maxCelsius: 2, minCelsius: 6 }) },
      'storage_temperature.max_celsius',
      TEMPERATURE_RANGE_ORDER_RULE_ID,
    ],
    [
      'unsupported currency',
      { minPrice: create(MoneySchema, { amountMinor: 1n, currencyCode: 'USD' }) },
      'min_price.currency_code',
      CURRENCY_UNSUPPORTED_RULE_ID,
    ],
    [
      'minimum price above a tier',
      { minPrice: rub(8600n), tierAmounts: [9000n, 8500n] },
      'min_price.amount_minor',
      MIN_PRICE_ABOVE_TIER_RULE_ID,
    ],
    ['base unit changed under a listing', { baseUnit: BaseUnit.GRAM, baseUnitLock: BaseUnit.PIECE }, 'base_unit', BASE_UNIT_LOCKED_RULE_ID],
  ];

  it.each(cases)('reports %s', (_name, overrides, fieldPath, ruleId) => {
    expect(collectProductViolations(buildProductInput(overrides))).toEqual([{ fieldPath, ruleId }]);
  });

  it('does not treat an empty gtin as taken and accepts a minimum price equal to a tier', () => {
    const input = buildProductInput({ minPrice: rub(8500n), takenGtins: new Set(['']), tierAmounts: [8500n, 9000n] });

    expect(collectProductViolations(input)).toEqual([]);
  });

  it('accepts the same base unit under a lock', () => {
    expect(collectProductViolations(buildProductInput({ baseUnitLock: BaseUnit.PIECE }))).toEqual([]);
  });

  it('collects every violation at once', () => {
    const violations = collectProductViolations(buildProductInput({
      minPrice: rub(500n),
      takenSkus: new Set(['A-1']),
      tierAmounts: [100n],
    }));

    expect(violations.map(violation => violation.ruleId)).toEqual([SKU_TAKEN_RULE_ID, MIN_PRICE_ABOVE_TIER_RULE_ID]);
  });
});

describe('collectListingViolations', () => {
  it('accepts a valid listing', () => {
    expect(collectListingViolations(buildListingInput())).toEqual([]);
  });

  const cases: RuleCaseTupleValue<ListingRulesInputValue>[] = [
    ['product taken', { isProductTaken: true }, 'product_id', LISTING_PRODUCT_TAKEN_RULE_ID],
    ['unknown sphere', { knownSphereIds: new Set<string>() }, 'sphere_ids[0]', SPHERE_EXISTS_RULE_ID],
    ['foreign warehouse', { ownWarehouseIds: new Set<string>() }, 'availability[0].warehouse_id', WAREHOUSE_EXISTS_RULE_ID],
    [
      'zero quantity in stock',
      { availability: [entry(WAREHOUSE_A, AvailabilityStatus.IN_STOCK, 0n)] },
      'availability[0].quantity',
      AVAILABILITY_QUANTITY_REQUIRED_RULE_ID,
    ],
    [
      'zero quantity when low',
      { availability: [entry(WAREHOUSE_A, AvailabilityStatus.LOW, 0n)] },
      'availability[0].quantity',
      AVAILABILITY_QUANTITY_REQUIRED_RULE_ID,
    ],
    ['minimum order not a multiple of the step', { minOrderQuantity: 12n }, 'min_order_quantity', MIN_ORDER_NOT_MULTIPLE_OF_STEP_RULE_ID],
    ['published listing without warehouses', { availability: [], isPublished: true }, 'availability', LISTING_WAREHOUSE_REQUIRED_RULE_ID],
    ['first tier above the minimum order', { existingFirstTierMinQuantity: 20n }, 'min_order_quantity', TIER_ABOVE_MINIMUM_ORDER_RULE_ID],
    [
      'product switched under a saved price',
      { priceLock: { baseQuantity: 1n, productId: PRODUCT_B } },
      'product_id',
      LISTING_PRODUCT_LOCKED_RULE_ID,
    ],
    [
      'price unit changed under a saved price',
      { baseQuantity: 1000n, priceLock: { baseQuantity: 1n, productId: PRODUCT_A } },
      'price_unit.base_quantity',
      PRICE_UNIT_LOCKED_RULE_ID,
    ],
  ];

  it.each(cases)('reports %s', (_name, overrides, fieldPath, ruleId) => {
    expect(collectListingViolations(buildListingInput(overrides))).toEqual([{ fieldPath, ruleId }]);
  });

  it('accepts the same product and the same price coefficient under a saved price', () => {
    expect(collectListingViolations(buildListingInput({ priceLock: { baseQuantity: 1n, productId: PRODUCT_A } }))).toEqual([]);
  });

  it('reports both locks when the product and the coefficient change together', () => {
    const violations = collectListingViolations(buildListingInput({
      baseQuantity: 12n,
      priceLock: { baseQuantity: 1n, productId: PRODUCT_B },
    }));

    expect(violations).toEqual([
      { fieldPath: 'product_id', ruleId: LISTING_PRODUCT_LOCKED_RULE_ID },
      { fieldPath: 'price_unit.base_quantity', ruleId: PRICE_UNIT_LOCKED_RULE_ID },
    ]);
  });

  it('reports a duplicated warehouse on the second entry only', () => {
    const duplicated = entry(WAREHOUSE_A, AvailabilityStatus.IN_STOCK, 5n);
    const violations = collectListingViolations(buildListingInput({ availability: [duplicated, duplicated] }));

    expect(violations).toEqual([{ fieldPath: 'availability[1].warehouse_id', ruleId: WAREHOUSE_DUPLICATE_RULE_ID }]);
  });

  it('accepts zero quantity for goods on order and a draft without warehouses', () => {
    const onOrder = entry(WAREHOUSE_A, AvailabilityStatus.ON_ORDER, 0n);

    expect(collectListingViolations(buildListingInput({ availability: [onOrder] }))).toEqual([]);
    expect(collectListingViolations(buildListingInput({ availability: [], isPublished: false }))).toEqual([]);
  });
});

describe('collectPublicationViolations', () => {
  it.each([
    [{ availabilityCount: 1, hasPrice: true }, []],
    [{ availabilityCount: 0, hasPrice: true }, [LISTING_WAREHOUSE_REQUIRED_RULE_ID]],
    [{ availabilityCount: 2, hasPrice: false }, [LISTING_PRICE_REQUIRED_RULE_ID]],
    [{ availabilityCount: 0, hasPrice: false }, [LISTING_WAREHOUSE_REQUIRED_RULE_ID, LISTING_PRICE_REQUIRED_RULE_ID]],
  ])('maps %j to %j', (input, ruleIds) => {
    expect(collectPublicationViolations(input).map(violation => violation.ruleId)).toEqual(ruleIds);
  });
});

describe('collectListingPriceViolations', () => {
  it('accepts ascending tiers that start at the minimum order', () => {
    expect(collectListingPriceViolations(buildPriceInput())).toEqual([]);
  });

  const cases: RuleCaseTupleValue<ListingPriceRulesInputValue>[] = [
    [
      'unsupported currency',
      { tiers: [create(PriceTierSchema, { minQuantity: 10n, price: create(MoneySchema, { amountMinor: 1n, currencyCode: 'EUR' }) })] },
      'tiers[0].price.currency_code',
      CURRENCY_UNSUPPORTED_RULE_ID,
    ],
    ['equal thresholds', { tiers: [tier(10n, 9000n), tier(10n, 8500n)] }, 'tiers[1].min_quantity', TIER_ORDER_RULE_ID],
    [
      'descending thresholds',
      { tiers: [tier(10n, 9000n), tier(50n, 8800n), tier(20n, 8500n)] },
      'tiers[2].min_quantity',
      TIER_ORDER_RULE_ID,
    ],
    ['first tier above the minimum order', { minOrderQuantity: 5n }, 'tiers[0].min_quantity', TIER_ABOVE_MINIMUM_ORDER_RULE_ID],
    [
      'price below the product minimum',
      { productMinPrice: rub(8600n) },
      'tiers[1].price.amount_minor',
      PRICE_BELOW_MINIMUM_RULE_ID,
    ],
  ];

  it.each(cases)('reports %s', (_name, overrides, fieldPath, ruleId) => {
    expect(collectListingPriceViolations(buildPriceInput(overrides))).toEqual([{ fieldPath, ruleId }]);
  });

  it('accepts a price equal to the product minimum', () => {
    expect(collectListingPriceViolations(buildPriceInput({ productMinPrice: rub(8500n) }))).toEqual([]);
  });
});

describe('collectTierAmounts', () => {
  it('lists the amounts of the tiers that carry a price', () => {
    expect(collectTierAmounts([tier(10n, 9000n), create(PriceTierSchema, { minQuantity: 20n }), tier(30n, 8500n)])).toEqual([9000n, 8500n]);
    expect(collectTierAmounts([])).toEqual([]);
  });
});

describe('collectSalesTermsViolations', () => {
  it('accepts a missing own delivery and rouble tariffs', () => {
    expect(collectSalesTermsViolations(undefined)).toEqual([]);
    expect(collectSalesTermsViolations(create(OwnDeliveryTermsSchema, { minimumCharge: rub(1n), pricePerKm: rub(1n) }))).toEqual([]);
  });

  it('reports each unsupported currency on its own path', () => {
    const usd = create(MoneySchema, { amountMinor: 1n, currencyCode: 'USD' });
    const violations = collectSalesTermsViolations(create(OwnDeliveryTermsSchema, { minimumCharge: usd, pricePerKm: usd }));

    expect(violations).toEqual([
      { fieldPath: 'own_delivery.price_per_km.currency_code', ruleId: CURRENCY_UNSUPPORTED_RULE_ID },
      { fieldPath: 'own_delivery.minimum_charge.currency_code', ruleId: CURRENCY_UNSUPPORTED_RULE_ID },
    ]);
  });
});
