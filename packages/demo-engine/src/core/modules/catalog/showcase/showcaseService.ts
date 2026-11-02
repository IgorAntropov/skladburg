import type { ServiceImpl } from '@connectrpc/connect';
import type {
  Listing,
  ListingPrice,
  Product,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type { Organization } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import {
  GetShowcaseListingResponseSchema,
  ListShowcaseListingsResponseSchema,
  ShowcaseService,
} from '@skladburg/contracts/catalog/v1/showcase';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';

import type { IModuleRuntime } from '../../moduleRuntime';
import type { ShowcaseDestinationValue } from './showcaseDestination';
import type { ISupplierRecords } from './supplierRecords';

import { ListingPublication } from '../../../state/index';
import {
  collectSphereSubtreeIds,
  isShowcaseListingVisible,
} from '../../../visibility/index';
import { paginate } from '../../pagination';
import {
  compareProductsByName,
  isTextIncludingQuery,
  normalizeCatalogQuery,
} from '../productQuery';
import { checkOrderQuantity } from '../quote/index';
import { resolveShowcaseDestination } from './showcaseDestination';
import { projectShowcaseListing } from './showcaseProjection';
import { createSupplierRecords } from './supplierRecords';

interface ShowcaseFilterValue {
  normalizedQuery: string;
  sphereIds: ReadonlySet<string> | undefined;
  supplierOrganizationId: string;
}

interface ShowcasePairValue {
  listing: Listing;
  listingPrice: ListingPrice;
  product: Product;
  supplier: Organization;
}

const isListingMatchingFilter = (listing: Listing, filter: ShowcaseFilterValue): boolean =>
  (filter.supplierOrganizationId === '' || listing.tenantId === filter.supplierOrganizationId)
  && (filter.sphereIds === undefined || listing.sphereIds.some(sphereId => filter.sphereIds?.has(sphereId) === true));

const isPairMatchingQuery = (pair: ShowcasePairValue, normalizedQuery: string): boolean =>
  normalizedQuery === ''
  || isTextIncludingQuery(pair.product.name, normalizedQuery)
  || isTextIncludingQuery(pair.supplier.name, normalizedQuery);

export const createCatalogShowcaseService = (runtime: IModuleRuntime): ServiceImpl<typeof ShowcaseService> => {
  const {
    errors,
    getWorldTimeMs,
    guard,
    read,
  } = runtime;

  const readViewer = (organizationId: string): Organization => {
    const viewer = read.get('organizations', organizationId);

    if (viewer === undefined) {
      throw errors.internal();
    }

    return viewer;
  };

  const readVisiblePair = (
    listing: Listing,
    viewer: Organization,
    destination: ShowcaseDestinationValue,
    records: ISupplierRecords,
  ): ShowcasePairValue | undefined => {
    const supplier = records.getOrganization(listing.tenantId);
    const listingPrice = read.get('listingPrices', listing.id);
    const product = read.get('products', listing.productId);

    if (supplier === undefined || listingPrice === undefined || product === undefined) {
      return undefined;
    }

    const isVisible = isShowcaseListingVisible({
      listing,
      listingPrice,
      priceList: records.getPriceList(listing.tenantId),
      supplier,
      today: destination.today,
      viewer,
    });

    return isVisible ? { listing, listingPrice, product, supplier } : undefined;
  };

  const project = (
    pair: ShowcasePairValue,
    quantity: bigint,
    destination: ShowcaseDestinationValue,
    records: ISupplierRecords,
  ): ShowcaseListing => projectShowcaseListing({
    ...pair,
    destination,
    quantity,
    terms: records.getSalesTerms(pair.listing.tenantId),
    warehouses: records.getWarehouses(pair.listing.tenantId),
    worldTimeMs: getWorldTimeMs(),
  });

  return {
    getShowcaseListing: (request, context) => {
      const caller = guard.guardPermissionCall(read, ShowcaseService.method.getShowcaseListing, request, context.requestHeader);
      const destination = resolveShowcaseDestination(runtime, caller.organizationId, request.toWarehouseId);
      const records = createSupplierRecords(read);
      const listing = read.get('listings', request.listingId);
      const pair = listing === undefined ? undefined : readVisiblePair(listing, readViewer(caller.organizationId), destination, records);

      if (pair === undefined) {
        throw errors.notFound(EntityKind.LISTING);
      }

      const { minOrderQuantity, orderStep } = pair.listing;
      const isMinimumRequested = request.quantity === 0n;
      const violations = isMinimumRequested ? [] : checkOrderQuantity({ minOrderQuantity, orderStep, quantity: request.quantity });

      if (violations.length > 0) {
        throw errors.validationFailed(violations);
      }

      return create(GetShowcaseListingResponseSchema, {
        listing: project(pair, isMinimumRequested ? minOrderQuantity : request.quantity, destination, records),
      });
    },
    listShowcaseListings: (request, context) => {
      const caller = guard.guardPermissionCall(read, ShowcaseService.method.listShowcaseListings, request, context.requestHeader);
      const destination = resolveShowcaseDestination(runtime, caller.organizationId, request.toWarehouseId);
      const viewer = readViewer(caller.organizationId);
      const records = createSupplierRecords(read);
      const filter: ShowcaseFilterValue = {
        normalizedQuery: normalizeCatalogQuery(request.query),
        sphereIds: request.sphereId === '' ? undefined : collectSphereSubtreeIds(read.list('spheres'), request.sphereId),
        supplierOrganizationId: request.supplierOrganizationId,
      };
      const pairs = read.listBy('listings', 'publication', ListingPublication.PUBLISHED)
        .flatMap((listing) => {
          const pair = isListingMatchingFilter(listing, filter) ? readVisiblePair(listing, viewer, destination, records) : undefined;

          return pair !== undefined && isPairMatchingQuery(pair, filter.normalizedQuery) ? [pair] : [];
        })
        .sort((current, prev) => compareProductsByName(current.product, prev.product));
      const { items, page } = paginate(pairs, pair => pair.listing.id, request.page, errors);

      return create(ListShowcaseListingsResponseSchema, {
        listings: items.map(pair => project(pair, pair.listing.minOrderQuantity, destination, records)),
        page,
      });
    },
  };
};
