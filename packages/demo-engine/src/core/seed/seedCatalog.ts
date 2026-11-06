import type {
  Listing,
  ListingPrice,
  PriceList,
  Product,
  SalesTerms,
  WarehouseAvailability,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { Money } from '@skladburg/contracts/common/v1/money';

import { create } from '@bufbuild/protobuf';
import {
  AvailabilityStatus,
  type BaseUnit,
  ListingPriceSchema,
  ListingSchema,
  MarkingMode,
  OwnDeliveryTermsSchema,
  PackagingSchema,
  PriceListSchema,
  PriceTierSchema,
  PriceUnitSchema,
  ProductSchema,
  SalesTermsSchema,
  TemperatureRangeSchema,
  VatRate,
  WarehouseAvailabilitySchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';

import {
  CONSTRUCTION_CEMENT_ROWS,
  CONSTRUCTION_METAL_ROWS,
  CONSTRUCTION_TIMBER_ROWS,
} from './seedCatalogConstruction';
import {
  FRESH_DAIRY_ROWS,
  FRESH_FRUIT_ROWS,
  FRESH_GARDEN_ROWS,
  FRESH_POULTRY_ROWS,
} from './seedCatalogFresh';
import {
  SeedOrganizationId,
  SeedSphereId,
  SeedWarehouseId,
} from './seedIds';

export type SeedPackagingValue = readonly [
  name: string,
  baseQuantity: number,
  grossWeightGrams: number,
  lengthMillimeters: number,
  widthMillimeters: number,
  heightMillimeters: number,
];

export interface SeedProfileValue {
  baseUnit: BaseUnit;
  minOrder: number;
  packagings: readonly SeedPackagingValue[];
  pallet?: readonly [packagingCount: number, heightMillimeters: number] | undefined;
  priceUnit: readonly [name: string, baseQuantity: number];
  shelfLifeDays: number;
  step: number;
  temperature?: readonly [minCelsius: number, maxCelsius: number];
}

export type SeedRowValue = readonly [
  name: string,
  profile: SeedProfileValue,
  priceRoubles: number,
  availabilityStatus: AvailabilityStatus,
  isDiscountForbidden: boolean,
  minPricePercent: 0 | 90 | 100,
  tierScheme: 0 | 1 | 2 | 3 | 4,
];

interface SeedSupplierValue {
  isAutoConfirmEnabled: boolean;
  number: number;
  organizationId: string;
  ownDelivery: readonly [pricePerKmRoubles: number, minimumChargeRoubles: number] | undefined;
  preparationWorkingDays: number;
  rows: readonly SeedRowValue[];
  sphereId: string;
  vatRate: VatRate;
  warehouseIds: readonly string[];
}

interface SeedTierValue {
  minQuantity: bigint;
  priceMinor: bigint;
}

const SEED_SUPPLIERS: readonly SeedSupplierValue[] = [
  {
    isAutoConfirmEnabled: false,
    number: 1,
    organizationId: SeedOrganizationId.SUPPLIER_1,
    ownDelivery: [12, 1500],
    preparationWorkingDays: 2,
    rows: FRESH_FRUIT_ROWS,
    sphereId: SeedSphereId.FRUIT_AND_VEGETABLES,
    vatRate: VatRate.VAT_RATE_10,
    warehouseIds: [SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1, SeedWarehouseId.SUPPLIER_1_WAREHOUSE_2],
  },
  {
    isAutoConfirmEnabled: false,
    number: 2,
    organizationId: SeedOrganizationId.SUPPLIER_2,
    ownDelivery: [14, 1800],
    preparationWorkingDays: 1,
    rows: FRESH_DAIRY_ROWS,
    sphereId: SeedSphereId.DAIRY,
    vatRate: VatRate.VAT_RATE_10,
    warehouseIds: [SeedWarehouseId.SUPPLIER_2_WAREHOUSE_1],
  },
  {
    isAutoConfirmEnabled: false,
    number: 3,
    organizationId: SeedOrganizationId.SUPPLIER_3,
    ownDelivery: [16, 3000],
    preparationWorkingDays: 3,
    rows: CONSTRUCTION_METAL_ROWS,
    sphereId: SeedSphereId.METAL_PRODUCTS,
    vatRate: VatRate.VAT_RATE_22,
    warehouseIds: [SeedWarehouseId.SUPPLIER_3_WAREHOUSE_1],
  },
  {
    isAutoConfirmEnabled: false,
    number: 4,
    organizationId: SeedOrganizationId.SUPPLIER_4,
    ownDelivery: undefined,
    preparationWorkingDays: 2,
    rows: CONSTRUCTION_CEMENT_ROWS,
    sphereId: SeedSphereId.CEMENT_AND_CONCRETE,
    vatRate: VatRate.VAT_RATE_22,
    warehouseIds: [SeedWarehouseId.SUPPLIER_4_WAREHOUSE_1],
  },
  {
    isAutoConfirmEnabled: false,
    number: 5,
    organizationId: SeedOrganizationId.SUPPLIER_5,
    ownDelivery: undefined,
    preparationWorkingDays: 1,
    rows: FRESH_GARDEN_ROWS,
    sphereId: SeedSphereId.FRUIT_AND_VEGETABLES,
    vatRate: VatRate.VAT_RATE_10,
    warehouseIds: [SeedWarehouseId.SUPPLIER_5_WAREHOUSE_1],
  },
  {
    isAutoConfirmEnabled: true,
    number: 6,
    organizationId: SeedOrganizationId.SUPPLIER_6,
    ownDelivery: [14, 1500],
    preparationWorkingDays: 1,
    rows: FRESH_POULTRY_ROWS,
    sphereId: SeedSphereId.MEAT_AND_POULTRY,
    vatRate: VatRate.VAT_RATE_10,
    warehouseIds: [SeedWarehouseId.SUPPLIER_6_WAREHOUSE_1],
  },
  {
    isAutoConfirmEnabled: true,
    number: 7,
    organizationId: SeedOrganizationId.SUPPLIER_7,
    ownDelivery: [16, 2500],
    preparationWorkingDays: 2,
    rows: CONSTRUCTION_TIMBER_ROWS,
    sphereId: SeedSphereId.TIMBER,
    vatRate: VatRate.VAT_RATE_22,
    warehouseIds: [SeedWarehouseId.SUPPLIER_7_WAREHOUSE_1],
  },
];

const TIER_SCHEMES: readonly (readonly (readonly [multiplier: number, discountPercent: number])[])[] = [
  [[1, 0], [4, 5]],
  [[1, 0], [3, 4], [10, 9]],
  [[1, 0], [2, 3], [6, 8]],
  [[1, 0], [5, 7]],
  [[1, 0], [2, 4], [8, 10]],
];

const CURRENCY_CODE = 'RUB';
const PRICE_LIST_VALID_UNTIL = { day: 31, month: 12, year: 2027 };
const GTIN_PREFIX = '21';
const GTIN_NUMBER_LENGTH = 9;
const GTIN_ODD_POSITION_WEIGHT = 3;
const DECIMAL_BASE = 10;
const KOPECKS_PER_ROUBLE = 100;
const VOLUME_DIVISOR = 1000;
const IN_STOCK_LOTS = 24n;
const LOW_LOTS = 2n;

const PALLET_TARE_GRAMS = 25_000;
const PALLET_LENGTH_MILLIMETERS = 1200;
const PALLET_WIDTH_MILLIMETERS = 800;

const padNumber = (value: number, length: number): string => String(value).padStart(length, '0');

const buildId = (prefix: string, supplier: number, tail: string): string =>
  `${prefix}${padNumber(supplier, 2)}${tail}-0000-4000-8000-000000000000`;

const buildProductId = (supplier: number, row: number): string => buildId('d0', supplier, padNumber(row, 4));

const buildListingId = (supplier: number, row: number): string => buildId('d1', supplier, padNumber(row, 4));

const buildPackagingId = (supplier: number, row: number, packaging: number): string =>
  buildId('d2', supplier, `${padNumber(row, 2)}${padNumber(packaging, 2)}`);

const buildPriceListId = (supplier: number): string => buildId('d3', supplier, '0000');

const buildSku = (supplier: number, row: number): string => `S${String(supplier)}-${padNumber(row, 3)}`;

const computeGtinCheckDigit = (body: string): number => {
  let sum = 0;

  for (let index = 0; index < body.length; index += 1) {
    sum += Number(body[body.length - 1 - index]) * (index % 2 === 0 ? GTIN_ODD_POSITION_WEIGHT : 1);
  }

  return (DECIMAL_BASE - (sum % DECIMAL_BASE)) % DECIMAL_BASE;
};

const buildGtin = (supplier: number, row: number): string => {
  const body = `${GTIN_PREFIX}${String(supplier)}${padNumber(row, GTIN_NUMBER_LENGTH)}`;

  return `${body}${String(computeGtinCheckDigit(body))}`;
};

const buildRub = (amountMinor: bigint): Money => create(MoneySchema, { amountMinor, currencyCode: CURRENCY_CODE });

const buildRubFromRoubles = (roubles: number): Money => buildRub(BigInt(roubles * KOPECKS_PER_ROUBLE));

const toBase = (priceUnits: number, profile: SeedProfileValue): bigint => BigInt(priceUnits) * BigInt(profile.priceUnit[1]);

const buildTiers = (row: SeedRowValue): SeedTierValue[] => {
  const [, profile, priceRoubles, , , , scheme] = row;
  const minOrderBase = toBase(profile.minOrder, profile);
  const tiers = TIER_SCHEMES[scheme] ?? [];

  return tiers.map(([multiplier, discountPercent]) => ({
    minQuantity: minOrderBase * BigInt(multiplier),
    priceMinor: BigInt(Math.round(priceRoubles * (KOPECKS_PER_ROUBLE - discountPercent))),
  }));
};

const buildMinPrice = (row: SeedRowValue): Money | undefined => {
  const minPricePercent = row[5];

  if (minPricePercent === 0) {
    return undefined;
  }

  const lowestMinor = buildTiers(row).at(-1)?.priceMinor ?? 0n;

  return buildRub(lowestMinor * BigInt(minPricePercent) / 100n);
};

const resolveLots = (status: AvailabilityStatus): bigint => {
  if (status === AvailabilityStatus.ON_ORDER) {
    return 0n;
  }

  return status === AvailabilityStatus.LOW ? LOW_LOTS : IN_STOCK_LOTS;
};

const buildAvailability = (row: SeedRowValue, supplier: SeedSupplierValue): WarehouseAvailability[] => {
  const minOrderBase = toBase(row[1].minOrder, row[1]);
  const status = row[3];
  const lots = resolveLots(status);

  return supplier.warehouseIds.map((warehouseId, index) => create(WarehouseAvailabilitySchema, {
    quantity: minOrderBase * lots / BigInt(index + 1),
    status,
    warehouseId,
  }));
};

const expandPackagings = (profile: SeedProfileValue): SeedPackagingValue[] => {
  const [first] = profile.packagings;

  if (profile.pallet === undefined || first === undefined) {
    return [...profile.packagings];
  }

  const [count, height] = profile.pallet;

  return [
    ...profile.packagings,
    [
      `Паллета ${String(count)} × ${first[0]}`,
      first[1] * count,
      first[2] * count + PALLET_TARE_GRAMS,
      PALLET_LENGTH_MILLIMETERS,
      PALLET_WIDTH_MILLIMETERS,
      height,
    ],
  ];
};

const forEachRow = <TResult>(
  callback: (row: SeedRowValue, supplier: SeedSupplierValue, rowNumber: number) => TResult,
): TResult[] =>
  SEED_SUPPLIERS.flatMap(supplier => supplier.rows.map((row, index) => callback(row, supplier, index + 1)));

export const createSeedProducts = (): Product[] =>
  forEachRow((row, supplier, rowNumber) => {
    const [name, profile] = row;

    return create(ProductSchema, {
      baseUnit: profile.baseUnit,
      gtin: buildGtin(supplier.number, rowNumber),
      id: buildProductId(supplier.number, rowNumber),
      isDiscountForbidden: row[4],
      markingMode: MarkingMode.NONE,
      minPrice: buildMinPrice(row),
      name,
      packagings: expandPackagings(profile).map(([packagingName, baseQuantity, grossWeight, length, width, height], index) =>
        create(PackagingSchema, {
          baseQuantity: BigInt(baseQuantity),
          grossWeightGrams: BigInt(grossWeight),
          heightMillimeters: height,
          id: buildPackagingId(supplier.number, rowNumber, index + 1),
          lengthMillimeters: length,
          name: packagingName,
          volumeCubicCentimeters: BigInt(Math.round(length * width * height / VOLUME_DIVISOR)),
          widthMillimeters: width,
        })),
      shelfLifeDays: profile.shelfLifeDays,
      sku: buildSku(supplier.number, rowNumber),
      storageTemperature: profile.temperature === undefined
        ? undefined
        : create(TemperatureRangeSchema, { maxCelsius: profile.temperature[1], minCelsius: profile.temperature[0] }),
      tenantId: supplier.organizationId,
      vatRate: supplier.vatRate,
      version: 1n,
    });
  });

export const createSeedListings = (): Listing[] =>
  forEachRow((row, supplier, rowNumber) => {
    const profile = row[1];

    return create(ListingSchema, {
      availability: buildAvailability(row, supplier),
      id: buildListingId(supplier.number, rowNumber),
      isPublished: true,
      minOrderQuantity: toBase(profile.minOrder, profile),
      orderStep: toBase(profile.step, profile),
      priceUnit: create(PriceUnitSchema, { baseQuantity: BigInt(profile.priceUnit[1]), name: profile.priceUnit[0] }),
      productId: buildProductId(supplier.number, rowNumber),
      sphereIds: [supplier.sphereId],
      tenantId: supplier.organizationId,
      version: 1n,
    });
  });

export const createSeedListingPrices = (): ListingPrice[] =>
  forEachRow((row, supplier, rowNumber) => create(ListingPriceSchema, {
    listingId: buildListingId(supplier.number, rowNumber),
    priceListId: buildPriceListId(supplier.number),
    tenantId: supplier.organizationId,
    tiers: buildTiers(row).map(tier => create(PriceTierSchema, {
      minQuantity: tier.minQuantity,
      price: buildRub(tier.priceMinor),
    })),
    version: 1n,
  }));

export const createSeedPriceLists = (): PriceList[] =>
  SEED_SUPPLIERS.map(supplier => create(PriceListSchema, {
    id: buildPriceListId(supplier.number),
    tenantId: supplier.organizationId,
    validUntil: create(CalendarDateSchema, PRICE_LIST_VALID_UNTIL),
    version: 1n,
  }));

export const createSeedSalesTerms = (): SalesTerms[] =>
  SEED_SUPPLIERS.map(supplier => create(SalesTermsSchema, {
    isAutoConfirmEnabled: supplier.isAutoConfirmEnabled,
    organizationId: supplier.organizationId,
    ownDelivery: supplier.ownDelivery === undefined
      ? undefined
      : create(OwnDeliveryTermsSchema, {
          minimumCharge: buildRubFromRoubles(supplier.ownDelivery[1]),
          pricePerKm: buildRubFromRoubles(supplier.ownDelivery[0]),
        }),
    preparationWorkingDays: supplier.preparationWorkingDays,
    version: 1n,
  }));
