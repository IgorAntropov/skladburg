import type { ServiceImpl } from '@connectrpc/connect';
import type { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';

import type { IModuleRuntime } from '../moduleRuntime';

import { createCatalogChangePublisher } from './catalogEvents';
import { createListingHandlers } from './listingHandlers';
import { createPriceHandlers } from './priceHandlers';
import { createPriceListHandlers } from './priceListHandlers';
import { createProductHandlers } from './productHandlers';
import { createPublicationHandlers } from './publicationHandlers';
import { createSalesTermsHandlers } from './salesTermsHandlers';

export const createCatalogService = (runtime: IModuleRuntime): ServiceImpl<typeof CatalogService> => {
  const publishChange = createCatalogChangePublisher(runtime.outbox);

  return {
    ...createListingHandlers(runtime, publishChange),
    ...createPriceHandlers(runtime, publishChange),
    ...createPriceListHandlers(runtime, publishChange),
    ...createProductHandlers(runtime, publishChange),
    ...createPublicationHandlers(runtime, publishChange),
    ...createSalesTermsHandlers(runtime, publishChange),
  };
};
