import type { ServiceImpl } from '@connectrpc/connect';
import type {
  Listing,
  Product,
} from '@skladburg/contracts/catalog/v1/catalog';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  CatalogService,
  GetOwnListingResponseSchema,
  ListingSchema,
  ListOwnListingsResponseSchema,
  OwnListingSchema,
  PriceUnitSchema,
  SaveListingResponseSchema,
  WarehouseAvailabilitySchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';

import type { IStateReader } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';
import type { PublishCatalogChangeFunction } from './catalogEvents';

import { paginate } from '../pagination';
import { collectListingViolations } from './catalogRules';
import {
  compareProductsByName,
  isCatalogQueryMatched,
} from './productQuery';
import {
  readOwned,
  readOwnedForSave,
} from './versionedRecords';

export type ListingHandlersValue = Pick<
  ServiceImpl<typeof CatalogService>,
  'getOwnListing' | 'listOwnListings' | 'saveListing'
>;

interface ListingWithProductValue {
  listing: Listing;
  product: Product;
}

const pairWithProduct = (reader: IStateReader, listing: Listing): ListingWithProductValue | undefined => {
  const product = reader.get('products', listing.productId);

  return product === undefined ? undefined : { listing, product };
};

export const createListingHandlers = (runtime: IModuleRuntime, publishChange: PublishCatalogChangeFunction): ListingHandlersValue => {
  const {
    command,
    errors,
    guard,
    idempotency,
    read,
  } = runtime;

  return {
    getOwnListing: (request, context) => {
      const caller = guard.guardPermissionCall(read, CatalogService.method.getOwnListing, request, context.requestHeader);
      const listing = readOwned(errors, EntityKind.LISTING, read.get('listings', request.listingId), caller.organizationId);
      const pair = pairWithProduct(read, listing);

      if (pair === undefined) {
        throw errors.notFound(EntityKind.PRODUCT);
      }

      return create(GetOwnListingResponseSchema, { listing: create(OwnListingSchema, pair) });
    },
    listOwnListings: (request, context) => {
      const caller = guard.guardPermissionCall(read, CatalogService.method.listOwnListings, request, context.requestHeader);
      const pairs = read.listBy('listings', 'tenantId', caller.organizationId)
        .flatMap((listing) => {
          const pair = pairWithProduct(read, listing);

          return pair !== undefined && isCatalogQueryMatched(pair.product, request.query) ? [pair] : [];
        })
        .sort((current, prev) => compareProductsByName(current.product, prev.product));
      const { items, page } = paginate(pairs, pair => pair.listing.id, request.page, errors);

      return create(ListOwnListingsResponseSchema, { listings: items.map(pair => create(OwnListingSchema, pair)), page });
    },
    saveListing: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, CatalogService.method.saveListing, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const organizationId = caller.organizationId;
          const current = readOwnedForSave(
            errors,
            EntityKind.LISTING,
            transaction.get('listings', request.listingId),
            organizationId,
            request.expectedVersion,
          );

          if (transaction.get('products', request.productId)?.tenantId !== organizationId) {
            throw errors.notFound(EntityKind.PRODUCT);
          }

          const existingPrice = transaction.get('listingPrices', request.listingId);
          const violations = collectListingViolations({
            availability: request.availability,
            baseQuantity: request.priceUnit?.baseQuantity ?? 0n,
            existingFirstTierMinQuantity: existingPrice?.tiers[0]?.minQuantity,
            isProductTaken: transaction.listBy('listings', 'tenantId', organizationId)
              .some(listing => listing.productId === request.productId && listing.id !== request.listingId),
            isPublished: current?.isPublished ?? false,
            knownSphereIds: new Set(request.sphereIds.filter(sphereId => transaction.get('spheres', sphereId) !== undefined)),
            minOrderQuantity: request.minOrderQuantity,
            orderStep: request.orderStep,
            ownWarehouseIds: new Set(
              request.availability
                .filter(entry => transaction.get('warehouses', entry.warehouseId)?.tenantId === organizationId)
                .map(entry => entry.warehouseId),
            ),
            priceLock: existingPrice === undefined || current === undefined
              ? undefined
              : { baseQuantity: current.priceUnit?.baseQuantity ?? 0n, productId: current.productId },
            productId: request.productId,
            sphereIds: request.sphereIds,
          });

          if (violations.length > 0) {
            throw errors.validationFailed(violations);
          }

          const listing = create(ListingSchema, {
            availability: request.availability.map(entry => clone(WarehouseAvailabilitySchema, entry)),
            id: request.listingId,
            isPublished: current?.isPublished ?? false,
            minOrderQuantity: request.minOrderQuantity,
            orderStep: request.orderStep,
            priceUnit: request.priceUnit === undefined ? undefined : clone(PriceUnitSchema, request.priceUnit),
            productId: request.productId,
            sphereIds: [...request.sphereIds],
            tenantId: organizationId,
            version: (current?.version ?? 0n) + 1n,
          });

          transaction.put('listings', listing);
          publishChange(transaction, organizationId, listing.isPublished);

          return create(SaveListingResponseSchema, { listing });
        },
        idempotencyKey: request.idempotencyKey,
        method: CatalogService.method.saveListing,
        request,
        scope: caller.organizationId,
      });
    }),
  };
};
