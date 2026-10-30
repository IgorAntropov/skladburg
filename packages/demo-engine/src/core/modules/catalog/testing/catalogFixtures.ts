import type { MessageInitShape } from '@bufbuild/protobuf';
import type { CallOptions } from '@connectrpc/connect';
import type {
  Listing,
  ListingPrice,
  Packaging,
  Product,
  SaveListingPriceRequest,
  SaveListingRequest,
  SaveProductRequest,
  WarehouseAvailability,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { EntityKind } from '@skladburg/contracts/common/v1/entity';
import type {
  ErrorCode,
  ErrorDetail,
} from '@skladburg/contracts/common/v1/error';
import type { Money } from '@skladburg/contracts/common/v1/money';
import type { Event } from '@skladburg/contracts/event/v1/event';

import { create } from '@bufbuild/protobuf';
import {
  AvailabilityStatus,
  BaseUnit,
  MarkingMode,
  PackagingSchema,
  PriceTierSchema,
  PriceUnitSchema,
  SaveListingPriceRequestSchema,
  SaveListingRequestSchema,
  SaveProductRequestSchema,
  VatRate,
  WarehouseAvailabilitySchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';

import type { ModuleHarnessValue } from '../../testing/moduleHarness';

import {
  SeedOrganizationId,
  SeedSphereId,
  SeedUserId,
  SeedWarehouseId,
} from '../../../seed/index';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../../testing/moduleHarness';

export type ListingOverridesValue = Omit<MessageInitShape<typeof SaveListingRequestSchema>, '$typeName'>;
export type PriceOverridesValue = Omit<MessageInitShape<typeof SaveListingPriceRequestSchema>, '$typeName'>;
export type ProductOverridesValue = Omit<MessageInitShape<typeof SaveProductRequestSchema>, '$typeName'>;

export const SUPPLIER_1_CALL: CallOptions = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
export const SUPPLIER_2_CALL: CallOptions = callAs(SeedUserId.ADMIN_3, SeedOrganizationId.SUPPLIER_2);

export const SUPPLIER_5_CALL: CallOptions = callAs(SeedUserId.ADMIN_9, SeedOrganizationId.SUPPLIER_5);

const OWN_WAREHOUSE_ID_BY_CALL = new Map<CallOptions, string>([
  [SUPPLIER_2_CALL, SeedWarehouseId.SUPPLIER_2_WAREHOUSE_1],
  [SUPPLIER_5_CALL, SeedWarehouseId.SUPPLIER_5_WAREHOUSE_1],
]);

export const GTIN_ONE = '2000000000015';
export const GTIN_TWO = '2000000000022';

let uuidCounter = 0;

export const nextUuid = (): string => {
  uuidCounter += 1;

  return `0a000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
};

export const buildRub = (amountMinor: bigint): Money =>
  create(MoneySchema, { amountMinor, currencyCode: 'RUB' });

export const buildPackaging = (id: string = nextUuid()): Packaging =>
  create(PackagingSchema, {
    baseQuantity: 12n,
    grossWeightGrams: 12500n,
    heightMillimeters: 250,
    id,
    lengthMillimeters: 400,
    name: 'Короб 12 шт.',
    volumeCubicCentimeters: 30000n,
    widthMillimeters: 300,
  });

export const buildProductRequest = (overrides: ProductOverridesValue = {}): SaveProductRequest =>
  create(SaveProductRequestSchema, {
    baseUnit: BaseUnit.PIECE,
    idempotencyKey: nextUuid(),
    markingMode: MarkingMode.NONE,
    name: 'Молоко пастеризованное',
    packagings: [buildPackaging()],
    productId: nextUuid(),
    sku: 'MLK-001',
    vatRate: VatRate.VAT_RATE_10,
    ...overrides,
  });

export const buildAvailability = (
  warehouseId: string,
  quantity = 100n,
  status: AvailabilityStatus = AvailabilityStatus.IN_STOCK,
): WarehouseAvailability =>
  create(WarehouseAvailabilitySchema, { quantity, status, warehouseId });

export const buildListingRequest = (productId: string, overrides: ListingOverridesValue = {}): SaveListingRequest =>
  create(SaveListingRequestSchema, {
    availability: [buildAvailability(SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1)],
    idempotencyKey: nextUuid(),
    listingId: nextUuid(),
    minOrderQuantity: 10n,
    orderStep: 5n,
    priceUnit: create(PriceUnitSchema, { baseQuantity: 1n, name: 'шт.' }),
    productId,
    sphereIds: [SeedSphereId.DAIRY],
    ...overrides,
  });

export const buildPriceRequest = (listingId: string, overrides: PriceOverridesValue = {}): SaveListingPriceRequest =>
  create(SaveListingPriceRequestSchema, {
    idempotencyKey: nextUuid(),
    listingId,
    tiers: [
      create(PriceTierSchema, { minQuantity: 10n, price: buildRub(9000n) }),
      create(PriceTierSchema, { minQuantity: 100n, price: buildRub(8500n) }),
    ],
    ...overrides,
  });

const requireValue = <TValue>(value: TValue | undefined): TValue => {
  if (value === undefined) {
    throw new Error('The response was expected to carry a value');
  }

  return value;
};

export const createProduct = async (
  harness: ModuleHarnessValue,
  overrides: ProductOverridesValue = {},
  call: CallOptions = SUPPLIER_1_CALL,
): Promise<Product> => {
  const response = await harness.catalog.saveProduct(buildProductRequest(overrides), call);

  return requireValue(response.product);
};

export const createListing = async (
  harness: ModuleHarnessValue,
  product: Product,
  overrides: ListingOverridesValue = {},
  call: CallOptions = SUPPLIER_1_CALL,
): Promise<Listing> => {
  const ownWarehouseId = OWN_WAREHOUSE_ID_BY_CALL.get(call);
  const ownAvailability = ownWarehouseId === undefined ? undefined : [buildAvailability(ownWarehouseId)];
  const response = await harness.catalog.saveListing(
    buildListingRequest(product.id, ownAvailability === undefined ? overrides : { availability: ownAvailability, ...overrides }),
    call,
  );

  return requireValue(response.listing);
};

export const createPrice = async (
  harness: ModuleHarnessValue,
  listing: Listing,
  overrides: PriceOverridesValue = {},
  call: CallOptions = SUPPLIER_1_CALL,
): Promise<ListingPrice> => {
  const response = await harness.catalog.saveListingPrice(buildPriceRequest(listing.id, overrides), call);

  return requireValue(response.price);
};

export const publishListing = async (
  harness: ModuleHarnessValue,
  listing: Listing,
  call: CallOptions = SUPPLIER_1_CALL,
): Promise<Listing> => {
  const response = await harness.catalog.setListingPublished(
    { expectedVersion: listing.version, idempotencyKey: nextUuid(), isPublished: true, listingId: listing.id },
    call,
  );

  return requireValue(response.listing);
};

export const createPublishedListing = async (
  harness: ModuleHarnessValue,
  call: CallOptions = SUPPLIER_1_CALL,
): Promise<{ listing: Listing; product: Product }> => {
  const product = await createProduct(harness, {}, call);
  const listing = await createListing(harness, product, {}, call);
  await createPrice(harness, listing, {}, call);

  return { listing: await publishListing(harness, listing, call), product };
};

export const getViolations = (detail: ErrorDetail): { fieldPath: string; ruleId: string }[] =>
  detail.params.case === 'validationFailed'
    ? detail.params.value.violations.map(violation => ({ fieldPath: violation.fieldPath, ruleId: violation.ruleId }))
    : [];

export const listCatalogEvents = (events: readonly Event[]): Event[] =>
  events.filter(event => event.payload.case === 'listingsChanged');

export interface FailureValue {
  code: ErrorCode;
  currentVersion: number;
  entity: EntityKind | undefined;
  violations: { fieldPath: string; ruleId: string }[];
}

export const captureFailure = async (call: Promise<unknown>): Promise<FailureValue> => {
  const detail = readErrorDetail(await captureError(call));
  const { params } = detail;

  return {
    code: detail.code,
    currentVersion: params.case === 'versionConflict' ? params.value.currentVersion : 0,
    entity: params.case === 'notFound' || params.case === 'versionConflict' ? params.value.entity : undefined,
    violations: getViolations(detail),
  };
};
