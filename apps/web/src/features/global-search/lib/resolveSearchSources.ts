export type SearchSiteSourceValue = 'map' | 'none' | 'warehouses';

export interface SearchSourcesInputValue {
  canViewCatalog: boolean;
  canViewMarketplace: boolean;
  canViewNetwork: boolean;
  canViewWarehouse: boolean;
  hasCustomerProfile: boolean;
  hasSupplierProfile: boolean;
  isCustomerVerified: boolean;
}

export interface SearchSourcesValue {
  cities: boolean;
  organizations: boolean;
  ownListings: boolean;
  showcaseListings: boolean;
  sites: SearchSiteSourceValue;
}

const resolveSiteSource = (canViewNetwork: boolean, canViewWarehouse: boolean): SearchSiteSourceValue => {
  if (canViewNetwork) {
    return 'map';
  }

  return canViewWarehouse ? 'warehouses' : 'none';
};

export const resolveSearchSources = ({
  canViewCatalog,
  canViewMarketplace,
  canViewNetwork,
  canViewWarehouse,
  hasCustomerProfile,
  hasSupplierProfile,
  isCustomerVerified,
}: SearchSourcesInputValue): SearchSourcesValue => ({
  cities: canViewNetwork,
  organizations: canViewNetwork,
  ownListings: hasSupplierProfile && canViewCatalog,
  showcaseListings: hasCustomerProfile && canViewMarketplace && isCustomerVerified,
  sites: resolveSiteSource(canViewNetwork, canViewWarehouse),
});

export const hasSearchSources = (sources: SearchSourcesValue): boolean => (
  sources.cities
  || sources.organizations
  || sources.ownListings
  || sources.showcaseListings
  || sources.sites !== 'none'
);
