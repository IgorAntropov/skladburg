interface GlobalSearchKeysValue {
  all: () => readonly ['global-search'];
  organizations: (scope: string) => readonly ['global-search', 'organizations', string];
  ownListings: (scope: string, normalizedQuery: string) => readonly ['global-search', 'own-listings', string, string];
  showcaseListings: (scope: string, normalizedQuery: string) => readonly ['global-search', 'showcase-listings', string, string];
  warehouses: (scope: string) => readonly ['global-search', 'warehouses', string];
}

export const globalSearchKeys: GlobalSearchKeysValue = {
  all: () => ['global-search'],
  organizations: scope => ['global-search', 'organizations', scope],
  ownListings: (scope, normalizedQuery) => ['global-search', 'own-listings', scope, normalizedQuery],
  showcaseListings: (scope, normalizedQuery) => ['global-search', 'showcase-listings', scope, normalizedQuery],
  warehouses: scope => ['global-search', 'warehouses', scope],
};
