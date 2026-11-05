import type {
  ImportRow,
  ImportRowError,
} from '@skladburg/contracts/import/v1/import';

import { create } from '@bufbuild/protobuf';
import {
  SaveListingPriceRequestSchema,
  SaveListingRequestSchema,
  SaveProductRequestSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { ImportRowErrorSchema } from '@skladburg/contracts/import/v1/import';

import type { IStateReader } from '../../state/index';
import type { IRequestValidator } from '../../validation/index';

import {
  collectListingPriceViolations,
  collectListingViolations,
  collectProductViolations,
} from '../catalog/catalogRules';
import { CATALOG_IMPORT_TEMPLATE } from './importTemplate';

export const buildImportRequests = (row: ImportRow): {
  listing: ReturnType<typeof create<typeof SaveListingRequestSchema>>;
  price: ReturnType<typeof create<typeof SaveListingPriceRequestSchema>>;
  product: ReturnType<typeof create<typeof SaveProductRequestSchema>>;
} => {
  const product = row.product;
  const listing = row.listing;
  const price = row.price;

  return {
    listing: create(SaveListingRequestSchema, {
      availability: listing?.availability, idempotencyKey: listing?.id, listingId: listing?.id,
      minOrderQuantity: listing?.minOrderQuantity, orderStep: listing?.orderStep, priceUnit: listing?.priceUnit,
      productId: listing?.productId, sphereIds: listing?.sphereIds,
    }),
    price: create(SaveListingPriceRequestSchema, { idempotencyKey: listing?.id, listingId: price?.listingId, tiers: price?.tiers }),
    product: create(SaveProductRequestSchema, {
      baseUnit: product?.baseUnit, gtin: product?.gtin, idempotencyKey: product?.id,
      isDiscountForbidden: product?.isDiscountForbidden, markingMode: product?.markingMode, minPrice: product?.minPrice,
      name: product?.name, packagings: product?.packagings, productId: product?.id, shelfLifeDays: product?.shelfLifeDays,
      sku: product?.sku, storageTemperature: product?.storageTemperature, vatRate: product?.vatRate,
    }),
  };
};

export const validateImportRows = (
  rows: readonly ImportRow[],
  reader: IStateReader,
  organizationId: string,
  validator: IRequestValidator,
  columns: readonly string[],
): ImportRowError[][] => {
  const products = reader.listBy('products', 'tenantId', organizationId);
  const takenSkus = new Set(products.map(product => product.sku));
  const takenGtins = new Set(products.map(product => product.gtin).filter(gtin => gtin !== ''));
  const knownSphereIds = new Set(reader.list('spheres').map(sphere => sphere.id));
  const productIds = new Set<string>();
  const listingIds = new Set<string>();

  return rows.map((row) => {
    const requests = buildImportRequests(row);
    const product = requests.product;
    const listing = requests.listing;
    const price = requests.price;
    const isProductIdTaken = reader.get('products', product.productId) !== undefined || productIds.has(product.productId);
    const isListingIdTaken = reader.get('listings', listing.listingId) !== undefined
      || reader.get('listingPrices', listing.listingId) !== undefined || listingIds.has(listing.listingId);
    const violations = [
      ...(isProductIdTaken ? [{ fieldPath: 'product_id', ruleId: 'import.identifier_taken' }] : []),
      ...(isListingIdTaken ? [{ fieldPath: 'listing_id', ruleId: 'import.identifier_taken' }] : []),
      ...validator.collect(SaveProductRequestSchema, product),
      ...validator.collect(SaveListingRequestSchema, listing),
      ...validator.collect(SaveListingPriceRequestSchema, price),
      ...collectProductViolations({
        baseUnit: product.baseUnit,
        baseUnitLock: undefined,
        gtin: product.gtin,
        minPrice: product.minPrice,
        packagings: product.packagings,
        sku: product.sku,
        storageTemperature: product.storageTemperature,
        takenGtins,
        takenSkus,
        tierAmounts: price.tiers.flatMap(tier => tier.price === undefined ? [] : [tier.price.amountMinor]),
      }),
      ...collectListingViolations({
        availability: [],
        baseQuantity: listing.priceUnit?.baseQuantity ?? 0n,
        existingFirstTierMinQuantity: undefined,
        isProductTaken: false,
        isPublished: false,
        knownSphereIds,
        minOrderQuantity: listing.minOrderQuantity,
        orderStep: listing.orderStep,
        ownWarehouseIds: new Set(),
        priceLock: undefined,
        productId: listing.productId,
        sphereIds: listing.sphereIds,
      }),
      ...collectListingPriceViolations({
        minOrderQuantity: listing.minOrderQuantity,
        productMinPrice: product.minPrice,
        tiers: price.tiers,
      }),
    ];
    productIds.add(product.productId);
    listingIds.add(listing.listingId);
    takenSkus.add(product.sku);
    if (product.gtin !== '') {
      takenGtins.add(product.gtin);
    }

    return violations.map((violation) => {
      const column = CATALOG_IMPORT_TEMPLATE.columns.find(candidate => candidate.fieldPath === violation.fieldPath
        || violation.fieldPath.startsWith(`${candidate.fieldPath}.`)
        || violation.fieldPath.startsWith(`${candidate.fieldPath}[`));
      return create(ImportRowErrorSchema, {
        columnNumber: column === undefined ? 0 : columns.indexOf(column.key) + 1,
        fieldPath: violation.fieldPath,
        rowNumber: row.rowNumber,
        ruleId: violation.ruleId,
      });
    });
  });
};
