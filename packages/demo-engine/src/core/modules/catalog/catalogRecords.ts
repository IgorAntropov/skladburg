import type {
  PriceList,
  SalesTerms,
} from '@skladburg/contracts/catalog/v1/catalog';

import { create } from '@bufbuild/protobuf';
import { SalesTermsSchema } from '@skladburg/contracts/catalog/v1/catalog';

import type { IStateReader } from '../../state/index';

const DEFAULT_PREPARATION_WORKING_DAYS = 1;

export const findPriceList = (reader: IStateReader, organizationId: string): PriceList | undefined =>
  reader.listBy('priceLists', 'tenantId', organizationId)[0];

export const hasPublishedListing = (reader: IStateReader, organizationId: string): boolean =>
  reader.listBy('listings', 'tenantId', organizationId).some(listing => listing.isPublished);

export const readSalesTerms = (reader: IStateReader, organizationId: string): SalesTerms =>
  reader.get('salesTerms', organizationId) ?? create(SalesTermsSchema, {
    organizationId,
    preparationWorkingDays: DEFAULT_PREPARATION_WORKING_DAYS,
  });
