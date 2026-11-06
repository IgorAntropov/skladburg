interface GlobalSearchKeysValue {
  all: () => readonly ['global-search'];
  deals: (scope: string, userId: string | undefined, query: string) => readonly ['global-search', 'deals', string, string, string];
  organizations: (scope: string) => readonly ['global-search', 'organizations', string];
  ownListings: (scope: string, normalizedQuery: string) => readonly ['global-search', 'own-listings', string, string];
  showcaseListings: (scope: string, normalizedQuery: string) => readonly ['global-search', 'showcase-listings', string, string];
}

export const globalSearchKeys: GlobalSearchKeysValue = {
  all: () => ['global-search'],
  deals: (scope, userId, query) => ['global-search', 'deals', scope, userId ?? '', query],
  organizations: scope => ['global-search', 'organizations', scope],
  ownListings: (scope, normalizedQuery) => ['global-search', 'own-listings', scope, normalizedQuery],
  showcaseListings: (scope, normalizedQuery) => ['global-search', 'showcase-listings', scope, normalizedQuery],
};
