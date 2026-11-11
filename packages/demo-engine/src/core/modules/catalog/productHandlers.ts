import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import {
  CatalogService,
  ListProductsResponseSchema,
  SaveProductResponseSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { parseSearchQuery } from '@skladburg/contracts/runtime';

import type { IModuleRuntime } from '../moduleRuntime';
import type { PublishCatalogChangeFunction } from './catalogEvents';

import { paginate } from '../pagination';
import {
  collectProductViolations,
  collectTierAmounts,
} from './catalogRules';
import { writeProduct } from './productMutation';
import {
  compareProductsByName,
  isCatalogQueryMatched,
} from './productQuery';
import { readOwnedForSave } from './versionedRecords';

export type ProductHandlersValue = Pick<ServiceImpl<typeof CatalogService>, 'listProducts' | 'saveProduct'>;

export const createProductHandlers = (runtime: IModuleRuntime, publishChange: PublishCatalogChangeFunction): ProductHandlersValue => {
  const {
    command,
    errors,
    guard,
    idempotency,
    read,
  } = runtime;

  return {
    listProducts: (request, context) => {
      const caller = guard.guardPermissionCall(read, CatalogService.method.listProducts, request, context.requestHeader);
      const query = parseSearchQuery(request.query);
      const products = read.listBy('products', 'tenantId', caller.organizationId)
        .filter(product => isCatalogQueryMatched(product, query))
        .sort(compareProductsByName);
      const { items, page } = paginate(products, product => product.id, request.page, errors);

      return create(ListProductsResponseSchema, { page, products: items });
    },
    saveProduct: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, CatalogService.method.saveProduct, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const organizationId = caller.organizationId;
          const current = readOwnedForSave(
            errors,
            EntityKind.PRODUCT,
            transaction.get('products', request.productId),
            organizationId,
            request.expectedVersion,
          );
          const others = transaction.listBy('products', 'tenantId', organizationId).filter(product => product.id !== request.productId);
          const productListings = transaction.listBy('listings', 'tenantId', organizationId)
            .filter(listing => listing.productId === request.productId);
          const tierAmounts = productListings
            .flatMap(listing => collectTierAmounts(transaction.get('listingPrices', listing.id)?.tiers ?? []));
          const isBaseUnitLocked = productListings.length > 0 || (current?.baseUnit !== request.baseUnit
            && transaction.listBy('stockBatches', 'productId', request.productId).length > 0);
          const violations = collectProductViolations({
            baseUnit: request.baseUnit,
            baseUnitLock: isBaseUnitLocked ? current?.baseUnit : undefined,
            gtin: request.gtin,
            minPrice: request.minPrice,
            packagings: request.packagings,
            sku: request.sku,
            storageTemperature: request.storageTemperature,
            takenGtins: new Set(others.map(product => product.gtin).filter(gtin => gtin !== '')),
            takenSkus: new Set(others.map(product => product.sku)),
            tierAmounts,
          });

          if (violations.length > 0) {
            throw errors.validationFailed(violations);
          }

          const product = writeProduct(transaction, request, organizationId, current);
          publishChange(transaction, organizationId, productListings.some(listing => listing.isPublished));

          return create(SaveProductResponseSchema, { product });
        },
        idempotencyKey: request.idempotencyKey,
        method: CatalogService.method.saveProduct,
        request,
        scope: caller.organizationId,
      });
    }),
  };
};
