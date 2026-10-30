import type { ServiceImpl } from '@connectrpc/connect';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  CatalogService,
  ListingPriceSchema,
  ListListingPricesResponseSchema,
  PriceListSchema,
  PriceTierSchema,
  SaveListingPriceResponseSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';

import type { IModuleRuntime } from '../moduleRuntime';
import type { PublishCatalogChangeFunction } from './catalogEvents';

import { paginate } from '../pagination';
import { findPriceList } from './catalogRecords';
import { collectListingPriceViolations } from './catalogRules';
import {
  assertVersionOrInitial,
  readOwned,
} from './versionedRecords';

export type PriceHandlersValue = Pick<ServiceImpl<typeof CatalogService>, 'listListingPrices' | 'saveListingPrice'>;

export const createPriceHandlers = (runtime: IModuleRuntime, publishChange: PublishCatalogChangeFunction): PriceHandlersValue => {
  const {
    command,
    errors,
    guard,
    idempotency,
    random,
    read,
  } = runtime;

  return {
    listListingPrices: (request, context) => {
      const caller = guard.guardPermissionCall(read, CatalogService.method.listListingPrices, request, context.requestHeader);
      const requestedIds = new Set(request.listingIds);
      const prices = read.listBy('listingPrices', 'tenantId', caller.organizationId)
        .filter(price => requestedIds.size === 0 || requestedIds.has(price.listingId));
      const { items, page } = paginate(prices, price => price.listingId, request.page, errors);

      return create(ListListingPricesResponseSchema, { page, prices: items });
    },
    saveListingPrice: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, CatalogService.method.saveListingPrice, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const organizationId = caller.organizationId;
          const listing = readOwned(errors, EntityKind.LISTING, transaction.get('listings', request.listingId), organizationId);
          const current = transaction.get('listingPrices', listing.id);
          const currentVersion = current?.version ?? 0n;

          assertVersionOrInitial(errors, EntityKind.PRICE_LIST, currentVersion, request.expectedVersion);

          const violations = collectListingPriceViolations({
            minOrderQuantity: listing.minOrderQuantity,
            productMinPrice: transaction.get('products', listing.productId)?.minPrice,
            tiers: request.tiers,
          });

          if (violations.length > 0) {
            throw errors.validationFailed(violations);
          }

          const existingPriceList = findPriceList(transaction, organizationId);
          const priceList = existingPriceList ?? create(PriceListSchema, { id: random.uuid(), tenantId: organizationId, version: 1n });

          if (existingPriceList === undefined) {
            transaction.put('priceLists', priceList);
          }

          const price = create(ListingPriceSchema, {
            listingId: listing.id,
            priceListId: priceList.id,
            tenantId: organizationId,
            tiers: request.tiers.map(tier => clone(PriceTierSchema, tier)),
            version: currentVersion + 1n,
          });

          transaction.put('listingPrices', price);
          publishChange(transaction, organizationId, listing.isPublished);

          return create(SaveListingPriceResponseSchema, { price });
        },
        idempotencyKey: request.idempotencyKey,
        method: CatalogService.method.saveListingPrice,
        request,
        scope: caller.organizationId,
      });
    }),
  };
};
