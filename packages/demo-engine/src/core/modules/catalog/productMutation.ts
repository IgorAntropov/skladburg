import type {
  Product,
  SaveProductRequest,
} from '@skladburg/contracts/catalog/v1/catalog';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  PackagingSchema,
  ProductSchema,
  TemperatureRangeSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';

import type { IStateTransaction } from '../../state/index';

export const writeProduct = (
  transaction: IStateTransaction,
  request: SaveProductRequest,
  organizationId: string,
  current: Product | undefined,
): Product => {
  const product = create(ProductSchema, {
    baseUnit: request.baseUnit,
    gtin: request.gtin,
    id: request.productId,
    isDiscountForbidden: request.isDiscountForbidden,
    markingMode: request.markingMode,
    minPrice: request.minPrice === undefined ? undefined : clone(MoneySchema, request.minPrice),
    name: request.name,
    packagings: request.packagings.map(packaging => clone(PackagingSchema, packaging)),
    shelfLifeDays: request.shelfLifeDays,
    sku: request.sku,
    storageTemperature: request.storageTemperature === undefined
      ? undefined
      : clone(TemperatureRangeSchema, request.storageTemperature),
    tenantId: organizationId,
    vatRate: request.vatRate,
    version: (current?.version ?? 0n) + 1n,
  });

  transaction.put('products', product);

  return product;
};
