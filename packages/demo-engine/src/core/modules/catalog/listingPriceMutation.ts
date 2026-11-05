import type {
  ListingPrice,
  SaveListingPriceRequest,
} from '@skladburg/contracts/catalog/v1/catalog';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  ListingPriceSchema,
  PriceListSchema,
  PriceTierSchema,
} from '@skladburg/contracts/catalog/v1/catalog';

import type { IRandom } from '../../ports/index';
import type { IStateTransaction } from '../../state/index';

import { findPriceList } from './catalogRecords';

export const writeListingPrice = (
  transaction: IStateTransaction,
  request: SaveListingPriceRequest,
  organizationId: string,
  currentVersion: bigint, random: IRandom,
): ListingPrice => {
  const existingPriceList = findPriceList(transaction, organizationId);
  const priceList = existingPriceList ?? create(PriceListSchema, { id: random.uuid(), tenantId: organizationId, version: 1n });

  if (existingPriceList === undefined) {
    transaction.put('priceLists', priceList);
  }

  const price = create(ListingPriceSchema, {
    listingId: request.listingId,
    priceListId: priceList.id,
    tenantId: organizationId,
    tiers: request.tiers.map(tier => clone(PriceTierSchema, tier)),
    version: currentVersion + 1n,
  });

  transaction.put('listingPrices', price);

  return price;
};
