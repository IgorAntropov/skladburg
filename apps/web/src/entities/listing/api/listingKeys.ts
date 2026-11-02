import type { ShowcaseListParamsValue } from './listingTypes';

interface ListingKeysValue {
  all: () => readonly ['listing'];
  own: (scope: string, query: string) => readonly ['listing', 'own', string, string];
  prices: (scope: string, listingIds: readonly string[]) => readonly ['listing', 'prices', string, readonly string[]];
  salesTerms: (scope: string) => readonly ['listing', 'sales-terms', string];
  showcase: (scope: string, params: ShowcaseListParamsValue) => readonly ['listing', 'showcase', string, ShowcaseListParamsValue];
  showcaseItem: (scope: string, listingId: string, toWarehouseId: string) => readonly ['listing', 'showcase-item', string, string, string];
}

export const listingKeys: ListingKeysValue = {
  all: () => ['listing'],
  own: (scope, query) => ['listing', 'own', scope, query],
  prices: (scope, listingIds) => ['listing', 'prices', scope, listingIds],
  salesTerms: scope => ['listing', 'sales-terms', scope],
  showcase: (scope, params) => ['listing', 'showcase', scope, params],
  showcaseItem: (scope, listingId, toWarehouseId) => ['listing', 'showcase-item', scope, listingId, toWarehouseId],
};
