import type { PriceList } from '@skladburg/contracts/catalog/v1/catalog';

import type { IStateReader } from '../../state/index';

export const findPriceList = (reader: IStateReader, organizationId: string): PriceList | undefined =>
  reader.listBy('priceLists', 'tenantId', organizationId)[0];

export const hasPublishedListing = (reader: IStateReader, organizationId: string): boolean =>
  reader.listBy('listings', 'tenantId', organizationId).some(listing => listing.isPublished);
