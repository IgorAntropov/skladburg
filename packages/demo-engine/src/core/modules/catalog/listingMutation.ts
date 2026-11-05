import type {
  Listing,
  SaveListingRequest,
} from '@skladburg/contracts/catalog/v1/catalog';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  ListingSchema,
  PriceUnitSchema,
  WarehouseAvailabilitySchema,
} from '@skladburg/contracts/catalog/v1/catalog';

import type { IStateTransaction } from '../../state/index';

export const writeListing = (
  transaction: IStateTransaction,
  request: SaveListingRequest,
  organizationId: string,
  current: Listing | undefined,
): Listing => {
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

  return listing;
};
