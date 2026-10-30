import {
  create,
  fromJson,
  type MessageInitShape,
} from '@bufbuild/protobuf';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  runFieldCheck,
  validateFormValues,
} from '../forms/index';
import {
  AvailabilityStatus,
  BaseUnit,
  ListListingPricesRequestSchema,
  MarkingMode,
  type OwnDeliveryTerms,
  OwnDeliveryTermsSchema,
  type Packaging,
  PackagingSchema,
  type PriceTier,
  PriceTierSchema,
  type PriceUnit,
  PriceUnitSchema,
  type SaveListingPriceRequest,
  SaveListingPriceRequestSchema,
  type SaveListingRequest,
  SaveListingRequestSchema,
  type SaveProductRequest,
  SaveProductRequestSchema,
  type SaveSalesTermsRequest,
  SaveSalesTermsRequestSchema,
  type TemperatureRange,
  TemperatureRangeSchema,
  VatRate,
  type WarehouseAvailability,
  WarehouseAvailabilitySchema,
} from '../gen/catalog/v1/catalog_pb';
import {
  type Money,
  MoneySchema,
} from '../gen/common/v1/money_pb';
import { SaveProductRequestFormRules } from '../gen/forms/catalog/v1/catalog_rules';
import { collectViolations } from './collectViolations';

const validUuid = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const otherUuid = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';
const thirdUuid = 'b7c1d2e3-4f56-4a78-9b01-23cd45ef6789';
const validGtin = '2000000000008';

const createMoney = (amountMinor: bigint): Money => create(MoneySchema, { amountMinor, currencyCode: 'RUB' });

const createTemperature = (minCelsius: number, maxCelsius: number): TemperatureRange =>
  create(TemperatureRangeSchema, { maxCelsius, minCelsius });

const createPriceUnit = (name: string, baseQuantity: bigint): PriceUnit =>
  create(PriceUnitSchema, { baseQuantity, name });

const createOwnDelivery = (): OwnDeliveryTerms =>
  create(OwnDeliveryTermsSchema, {
    minimumCharge: createMoney(150_000n),
    pricePerKm: createMoney(4_500n),
  });

const createPackaging = (overrides: MessageInitShape<typeof PackagingSchema> = {}): Packaging =>
  create(PackagingSchema, {
    baseQuantity: 12n,
    grossWeightGrams: 6_500n,
    heightMillimeters: 150,
    id: validUuid,
    lengthMillimeters: 400,
    name: 'Коробка',
    volumeCubicCentimeters: 9_000n,
    widthMillimeters: 150,
    ...overrides,
  });

const createAvailability = (overrides: MessageInitShape<typeof WarehouseAvailabilitySchema> = {}): WarehouseAvailability =>
  create(WarehouseAvailabilitySchema, {
    quantity: 120n,
    status: AvailabilityStatus.IN_STOCK,
    warehouseId: validUuid,
    ...overrides,
  });

const createTier = (overrides: MessageInitShape<typeof PriceTierSchema> = {}): PriceTier =>
  create(PriceTierSchema, {
    minQuantity: 10n,
    price: createMoney(8_900n),
    ...overrides,
  });

const createSaveProductRequest = (overrides: MessageInitShape<typeof SaveProductRequestSchema> = {}): SaveProductRequest =>
  create(SaveProductRequestSchema, {
    baseUnit: BaseUnit.PIECE,
    expectedVersion: 0n,
    gtin: validGtin,
    idempotencyKey: validUuid,
    markingMode: MarkingMode.NONE,
    name: 'Йогурт натуральный 125 г',
    packagings: [createPackaging()],
    productId: otherUuid,
    shelfLifeDays: 21,
    sku: 'YOG-125',
    storageTemperature: createTemperature(2, 6),
    vatRate: VatRate.VAT_RATE_10,
    ...overrides,
  });

const createSaveListingRequest = (overrides: MessageInitShape<typeof SaveListingRequestSchema> = {}): SaveListingRequest =>
  create(SaveListingRequestSchema, {
    availability: [createAvailability()],
    expectedVersion: 0n,
    idempotencyKey: validUuid,
    listingId: otherUuid,
    minOrderQuantity: 12n,
    orderStep: 12n,
    priceUnit: createPriceUnit('шт.', 1n),
    productId: thirdUuid,
    sphereIds: [validUuid],
    ...overrides,
  });

describe('SaveProductRequest', () => {
  it('accepts a complete product', () => {
    expect(collectViolations(SaveProductRequestSchema, createSaveProductRequest())).toEqual([]);
  });

  it('accepts a product without GTIN, temperature and minimum price', () => {
    const request = createSaveProductRequest({ gtin: '', storageTemperature: undefined });

    expect(collectViolations(SaveProductRequestSchema, request)).toEqual([]);
  });

  it.each(['20000011', '200000000004', '2000000000008', '20000000000011'])('accepts GTIN %s', (gtin) => {
    expect(collectViolations(SaveProductRequestSchema, createSaveProductRequest({ gtin }))).toEqual([]);
  });

  it.each(['2000001', '200000110', '20000000008', '2000000000O08', '2000000000008\n'])('rejects GTIN %j', (gtin) => {
    expect(collectViolations(SaveProductRequestSchema, createSaveProductRequest({ gtin }))).toEqual([
      { fieldPath: 'gtin', ruleId: 'string.pattern' },
    ]);
  });

  it('rejects a negative minimum price on the nested field', () => {
    const request = createSaveProductRequest({ minPrice: createMoney(-1n) });

    expect(collectViolations(SaveProductRequestSchema, request)).toEqual([
      { fieldPath: 'min_price.amount_minor', ruleId: 'int64.gte' },
    ]);
  });

  it('rejects a storage temperature out of the range', () => {
    const request = createSaveProductRequest({ storageTemperature: createTemperature(2, 61) });

    expect(collectViolations(SaveProductRequestSchema, request)).toEqual([
      { fieldPath: 'storage_temperature.max_celsius', ruleId: 'int32.gte_lte' },
    ]);
  });

  it('rejects a shelf life above ten years', () => {
    expect(collectViolations(SaveProductRequestSchema, createSaveProductRequest({ shelfLifeDays: 3651 }))).toEqual([
      { fieldPath: 'shelf_life_days', ruleId: 'int32.gte_lte' },
    ]);
  });

  it.each([
    { expected: { fieldPath: 'name', ruleId: 'required' }, overrides: { name: '' } },
    { expected: { fieldPath: 'sku', ruleId: 'required' }, overrides: { sku: '' } },
    { expected: { fieldPath: 'sku', ruleId: 'string.max_len' }, overrides: { sku: 'a'.repeat(65) } },
    { expected: { fieldPath: 'base_unit', ruleId: 'enum.not_in' }, overrides: { baseUnit: BaseUnit.UNSPECIFIED } },
    { expected: { fieldPath: 'marking_mode', ruleId: 'enum.not_in' }, overrides: { markingMode: MarkingMode.UNSPECIFIED } },
    { expected: { fieldPath: 'vat_rate', ruleId: 'enum.not_in' }, overrides: { vatRate: VatRate.VAT_RATE_UNSPECIFIED } },
    { expected: { fieldPath: 'expected_version', ruleId: 'int64.gte' }, overrides: { expectedVersion: -1n } },
    { expected: { fieldPath: 'idempotency_key', ruleId: 'string.uuid' }, overrides: { idempotencyKey: 'not-a-uuid' } },
    { expected: { fieldPath: 'product_id', ruleId: 'string.uuid_empty' }, overrides: { productId: '' } },
  ])('rejects $expected.fieldPath with $expected.ruleId', ({ expected, overrides }) => {
    expect(collectViolations(SaveProductRequestSchema, createSaveProductRequest(overrides))).toEqual([expected]);
  });

  it('rejects a product without packagings', () => {
    expect(collectViolations(SaveProductRequestSchema, createSaveProductRequest({ packagings: [] }))).toEqual([
      { fieldPath: 'packagings', ruleId: 'repeated.min_items' },
    ]);
  });

  it('rejects more than ten packagings', () => {
    const packagings = Array.from({ length: 11 }, () => createPackaging());

    expect(collectViolations(SaveProductRequestSchema, createSaveProductRequest({ packagings }))).toEqual([
      { fieldPath: 'packagings', ruleId: 'repeated.max_items' },
    ]);
  });

  it('points to the packaging that breaks a rule', () => {
    const request = createSaveProductRequest({
      packagings: [createPackaging(), createPackaging({ baseQuantity: 0n })],
    });

    expect(collectViolations(SaveProductRequestSchema, request)).toEqual([
      { fieldPath: 'packagings[1].base_quantity', ruleId: 'int64.gt' },
    ]);
  });
});

describe('the GTIN check in the table of SaveProductRequest', () => {
  const names = ['gtin'];

  it('accepts a correct GTIN and an empty one', () => {
    expect(validateFormValues(SaveProductRequestFormRules, { gtin: validGtin }, names, { runCheck: runFieldCheck })).toEqual([]);
    expect(validateFormValues(SaveProductRequestFormRules, { gtin: '' }, names, { runCheck: runFieldCheck })).toEqual([]);
  });

  it('reports a wrong check digit', () => {
    expect(validateFormValues(SaveProductRequestFormRules, { gtin: '2000000000009' }, names, { runCheck: runFieldCheck })).toEqual([
      { field: 'gtin', ruleId: 'field_check.gtin' },
    ]);
  });

  it('reports the pattern and keeps silent about the check digit while the length is wrong', () => {
    expect(validateFormValues(SaveProductRequestFormRules, { gtin: '200000110' }, names, { runCheck: runFieldCheck })).toEqual([
      { field: 'gtin', ruleId: 'string.pattern' },
    ]);
  });
});

describe('Packaging', () => {
  it('accepts a complete packaging', () => {
    expect(collectViolations(PackagingSchema, createPackaging())).toEqual([]);
  });

  it.each([
    { expected: { fieldPath: 'base_quantity', ruleId: 'int64.gt' }, overrides: { baseQuantity: 0n } },
    { expected: { fieldPath: 'gross_weight_grams', ruleId: 'int64.gt' }, overrides: { grossWeightGrams: 0n } },
    { expected: { fieldPath: 'volume_cubic_centimeters', ruleId: 'int64.gt' }, overrides: { volumeCubicCentimeters: -1n } },
    { expected: { fieldPath: 'length_millimeters', ruleId: 'int32.gt' }, overrides: { lengthMillimeters: 0 } },
    { expected: { fieldPath: 'width_millimeters', ruleId: 'int32.gt' }, overrides: { widthMillimeters: 0 } },
    { expected: { fieldPath: 'height_millimeters', ruleId: 'int32.gt' }, overrides: { heightMillimeters: 0 } },
    { expected: { fieldPath: 'name', ruleId: 'required' }, overrides: { name: '' } },
    { expected: { fieldPath: 'name', ruleId: 'string.max_len' }, overrides: { name: 'я'.repeat(81) } },
    { expected: { fieldPath: 'id', ruleId: 'string.uuid_empty' }, overrides: { id: '' } },
  ])('rejects $expected.fieldPath with $expected.ruleId', ({ expected, overrides }) => {
    expect(collectViolations(PackagingSchema, createPackaging(overrides))).toEqual([expected]);
  });
});

describe('SaveListingRequest', () => {
  it('accepts a complete listing', () => {
    expect(collectViolations(SaveListingRequestSchema, createSaveListingRequest())).toEqual([]);
  });

  it('accepts a listing without availability', () => {
    expect(collectViolations(SaveListingRequestSchema, createSaveListingRequest({ availability: [] }))).toEqual([]);
  });

  it('rejects a listing without a sphere', () => {
    expect(collectViolations(SaveListingRequestSchema, createSaveListingRequest({ sphereIds: [] }))).toEqual([
      { fieldPath: 'sphere_ids', ruleId: 'repeated.min_items' },
    ]);
  });

  it('rejects a repeated sphere', () => {
    const request = createSaveListingRequest({ sphereIds: [validUuid, validUuid] });

    expect(collectViolations(SaveListingRequestSchema, request)).toEqual([
      { fieldPath: 'sphere_ids', ruleId: 'repeated.unique' },
    ]);
  });

  it('rejects more than eight spheres', () => {
    const sphereIds = Array.from({ length: 9 }, (_item, index) => `3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d15${String(index)}`);

    expect(collectViolations(SaveListingRequestSchema, createSaveListingRequest({ sphereIds }))).toEqual([
      { fieldPath: 'sphere_ids', ruleId: 'repeated.max_items' },
    ]);
  });

  it('points to the sphere that is not an identifier', () => {
    const request = createSaveListingRequest({ sphereIds: [validUuid, 'fresh'] });

    expect(collectViolations(SaveListingRequestSchema, request)).toEqual([
      { fieldPath: 'sphere_ids[1]', ruleId: 'string.uuid' },
    ]);
  });

  it('rejects a listing without a price unit', () => {
    expect(collectViolations(SaveListingRequestSchema, createSaveListingRequest({ priceUnit: undefined }))).toEqual([
      { fieldPath: 'price_unit', ruleId: 'required' },
    ]);
  });

  it('rejects a price unit with a zero ratio', () => {
    const request = createSaveListingRequest({ priceUnit: createPriceUnit('кг', 0n) });

    expect(collectViolations(SaveListingRequestSchema, request)).toEqual([
      { fieldPath: 'price_unit.base_quantity', ruleId: 'int64.gt' },
    ]);
  });

  it.each([
    { expected: { fieldPath: 'min_order_quantity', ruleId: 'int64.gt' }, overrides: { minOrderQuantity: 0n } },
    { expected: { fieldPath: 'order_step', ruleId: 'int64.gt' }, overrides: { orderStep: 0n } },
  ])('rejects $expected.fieldPath with $expected.ruleId', ({ expected, overrides }) => {
    expect(collectViolations(SaveListingRequestSchema, createSaveListingRequest(overrides))).toEqual([expected]);
  });

  it('rejects more than fifty warehouses of availability', () => {
    const availability = Array.from({ length: 51 }, () => createAvailability());

    expect(collectViolations(SaveListingRequestSchema, createSaveListingRequest({ availability }))).toEqual([
      { fieldPath: 'availability', ruleId: 'repeated.max_items' },
    ]);
  });

  it('points to the availability that breaks a rule', () => {
    const request = createSaveListingRequest({
      availability: [createAvailability(), createAvailability({ quantity: -1n })],
    });

    expect(collectViolations(SaveListingRequestSchema, request)).toEqual([
      { fieldPath: 'availability[1].quantity', ruleId: 'int64.gte' },
    ]);
  });
});

describe('WarehouseAvailability', () => {
  it.each([AvailabilityStatus.IN_STOCK, AvailabilityStatus.LOW, AvailabilityStatus.ON_ORDER])(
    'accepts the status %s and a zero quantity',
    (status) => {
      expect(collectViolations(WarehouseAvailabilitySchema, createAvailability({ quantity: 0n, status }))).toEqual([]);
    },
  );

  it('rejects an unspecified status', () => {
    expect(collectViolations(WarehouseAvailabilitySchema, createAvailability({ status: AvailabilityStatus.UNSPECIFIED }))).toEqual([
      { fieldPath: 'status', ruleId: 'enum.not_in' },
    ]);
  });

  it('rejects an unknown status', () => {
    const availability = fromJson(WarehouseAvailabilitySchema, { quantity: '1', status: 99, warehouseId: validUuid });

    expect(collectViolations(WarehouseAvailabilitySchema, availability)).toEqual([
      { fieldPath: 'status', ruleId: 'enum.defined_only' },
    ]);
  });

  it('rejects a warehouse that is not an identifier', () => {
    expect(collectViolations(WarehouseAvailabilitySchema, createAvailability({ warehouseId: 'north' }))).toEqual([
      { fieldPath: 'warehouse_id', ruleId: 'string.uuid' },
    ]);
  });
});

describe('SaveListingPriceRequest', () => {
  const createRequest = (overrides: MessageInitShape<typeof SaveListingPriceRequestSchema> = {}): SaveListingPriceRequest =>
    create(SaveListingPriceRequestSchema, {
      expectedVersion: 0n,
      idempotencyKey: validUuid,
      listingId: otherUuid,
      tiers: [createTier()],
      ...overrides,
    });

  it('accepts several tiers', () => {
    const request = createRequest({
      tiers: [createTier({ minQuantity: 1n }), createTier({ minQuantity: 100n, price: createMoney(8_500n) })],
    });

    expect(collectViolations(SaveListingPriceRequestSchema, request)).toEqual([]);
  });

  it('rejects a request without tiers', () => {
    expect(collectViolations(SaveListingPriceRequestSchema, createRequest({ tiers: [] }))).toEqual([
      { fieldPath: 'tiers', ruleId: 'repeated.min_items' },
    ]);
  });

  it('rejects more than ten tiers', () => {
    const tiers = Array.from({ length: 11 }, () => createTier());

    expect(collectViolations(SaveListingPriceRequestSchema, createRequest({ tiers }))).toEqual([
      { fieldPath: 'tiers', ruleId: 'repeated.max_items' },
    ]);
  });

  it('points to the tier with a negative price', () => {
    const request = createRequest({
      tiers: [createTier(), createTier({ price: createMoney(-100n) })],
    });

    expect(collectViolations(SaveListingPriceRequestSchema, request)).toEqual([
      { fieldPath: 'tiers[1].price.amount_minor', ruleId: 'int64.gte' },
    ]);
  });
});

describe('PriceTier', () => {
  it('accepts a tier with a zero price', () => {
    const tier = createTier({ price: createMoney(0n) });

    expect(collectViolations(PriceTierSchema, tier)).toEqual([]);
  });

  it('rejects a zero minimum quantity', () => {
    expect(collectViolations(PriceTierSchema, createTier({ minQuantity: 0n }))).toEqual([
      { fieldPath: 'min_quantity', ruleId: 'int64.gt' },
    ]);
  });

  it('rejects a tier without a price', () => {
    expect(collectViolations(PriceTierSchema, createTier({ price: undefined }))).toEqual([
      { fieldPath: 'price', ruleId: 'required' },
    ]);
  });
});

describe('ListListingPricesRequest', () => {
  it('accepts a request without identifiers', () => {
    expect(collectViolations(ListListingPricesRequestSchema, create(ListListingPricesRequestSchema))).toEqual([]);
  });

  it('accepts a list of listings', () => {
    const request = create(ListListingPricesRequestSchema, { listingIds: [validUuid, otherUuid] });

    expect(collectViolations(ListListingPricesRequestSchema, request)).toEqual([]);
  });

  it('rejects a repeated listing', () => {
    const request = create(ListListingPricesRequestSchema, { listingIds: [validUuid, validUuid] });

    expect(collectViolations(ListListingPricesRequestSchema, request)).toEqual([
      { fieldPath: 'listing_ids', ruleId: 'repeated.unique' },
    ]);
  });

  it('rejects more than two hundred listings', () => {
    const listingIds = Array.from({ length: 201 }, (_item, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    const request = create(ListListingPricesRequestSchema, { listingIds });

    expect(collectViolations(ListListingPricesRequestSchema, request)).toEqual([
      { fieldPath: 'listing_ids', ruleId: 'repeated.max_items' },
    ]);
  });

  it('points to the listing that is not an identifier', () => {
    const request = create(ListListingPricesRequestSchema, { listingIds: [validUuid, 'milk'] });

    expect(collectViolations(ListListingPricesRequestSchema, request)).toEqual([
      { fieldPath: 'listing_ids[1]', ruleId: 'string.uuid' },
    ]);
  });
});

describe('SaveSalesTermsRequest', () => {
  const createRequest = (overrides: MessageInitShape<typeof SaveSalesTermsRequestSchema> = {}): SaveSalesTermsRequest =>
    create(SaveSalesTermsRequestSchema, {
      expectedVersion: 0n,
      idempotencyKey: validUuid,
      ownDelivery: createOwnDelivery(),
      preparationWorkingDays: 1,
      ...overrides,
    });

  it('accepts terms with own delivery', () => {
    expect(collectViolations(SaveSalesTermsRequestSchema, createRequest())).toEqual([]);
  });

  it('accepts terms without own delivery and with auto confirmation', () => {
    const request = createRequest({ isAutoConfirmEnabled: true, ownDelivery: undefined });

    expect(collectViolations(SaveSalesTermsRequestSchema, request)).toEqual([]);
  });

  it.each([0, 30])('accepts %i preparation days', (preparationWorkingDays) => {
    expect(collectViolations(SaveSalesTermsRequestSchema, createRequest({ preparationWorkingDays }))).toEqual([]);
  });

  it.each([-1, 31])('rejects %i preparation days', (preparationWorkingDays) => {
    expect(collectViolations(SaveSalesTermsRequestSchema, createRequest({ preparationWorkingDays }))).toEqual([
      { fieldPath: 'preparation_working_days', ruleId: 'int32.gte_lte' },
    ]);
  });

  it('rejects a negative price per kilometre on the nested field', () => {
    const request = createRequest({
      ownDelivery: create(OwnDeliveryTermsSchema, {
        minimumCharge: createMoney(150_000n),
        pricePerKm: createMoney(-1n),
      }),
    });

    expect(collectViolations(SaveSalesTermsRequestSchema, request)).toEqual([
      { fieldPath: 'own_delivery.price_per_km.amount_minor', ruleId: 'int64.gte' },
    ]);
  });

  it('rejects own delivery without a minimum charge', () => {
    const request = createRequest({
      ownDelivery: create(OwnDeliveryTermsSchema, { pricePerKm: createMoney(4_500n) }),
    });

    expect(collectViolations(SaveSalesTermsRequestSchema, request)).toEqual([
      { fieldPath: 'own_delivery.minimum_charge', ruleId: 'required' },
    ]);
  });
});
