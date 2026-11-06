import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  normalizeSearchText,
  parseSearchQuery,
} from '@skladburg/contracts/runtime';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  createOwnListingQueryMeta,
  createShowcaseQueryMeta,
  fetchOwnListings,
  fetchShowcaseListings,
  type OwnListingsPageValue,
  type ShowcasePageValue,
} from '@/entities/listing';
import {
  createNetworkDirectoryQueryOptions,
  networkKeys,
} from '@/entities/network';
import {
  isProfileVerified,
  useActingOrganizationQuery,
} from '@/entities/organization';
import { useCan } from '@/entities/session';
import { warehouseKeys } from '@/entities/warehouse';
import {
  createOrganizationQueryMeta,
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import type {
  GlobalSearchValue,
  SearchGroupValue,
} from '../model/searchResultTypes';

import { buildSearchGroups } from '../lib/buildSearchGroups';
import { classifySearchQuery } from '../lib/classifySearchQuery';
import {
  hasSearchSources,
  resolveSearchSources,
} from '../lib/resolveSearchSources';
import { resolveSearchStatus } from '../lib/resolveSearchStatus';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { fetchSearchMapSites } from './fetchSearchMapSites';
import { fetchSearchOrganizations } from './fetchSearchOrganizations';
import { fetchSearchWarehouses } from './fetchSearchWarehouses';
import { globalSearchKeys } from './globalSearchKeys';
import { keepScopedPlaceholder } from './keepScopedPlaceholder';
import { useSearchSourceState } from './useSearchSourceState';

const SERVER_SEARCH_DELAY_MS = 150;
const ORGANIZATIONS_STALE_TIME_MS = 30_000;
const SITE_EVENT_CASES = ['warehouseChanged', 'warehouseCreated'] as const;
const NO_PROFILES: readonly OrganizationProfile[] = [];
const NO_GROUPS: readonly SearchGroupValue[] = [];

const hasProfile = (profiles: readonly OrganizationProfile[], kind: ProfileKind): boolean => (
  profiles.some(profile => profile.kind === kind)
);

export const useGlobalSearch = (query: string, organizationId: string | undefined): GlobalSearchValue => {
  const client = useApiClient();
  const { userId } = useActingContext();
  const canViewDeals = useCan(PermissionCode.DEAL_VIEW, { kind: 'organization' });
  const canViewCatalog = useCan(PermissionCode.CATALOG_VIEW);
  const canViewMarketplace = useCan(PermissionCode.MARKETPLACE_VIEW);
  const canViewNetwork = useCan(PermissionCode.NETWORK_VIEW);
  const canViewWarehouse = useCan(PermissionCode.WAREHOUSE_VIEW);
  const { data: organization, isLoading: isOrganizationLoading } = useActingOrganizationQuery();

  const normalizedQuery = useMemo(() => normalizeSearchText(query), [query]);
  const parsedQuery = useMemo(() => parseSearchQuery(query), [query]);
  const debouncedQuery = useDebouncedValue(normalizedQuery, SERVER_SEARCH_DELAY_MS);

  const profiles = organization?.profiles ?? NO_PROFILES;
  const queryKind = classifySearchQuery(normalizedQuery);
  const scope = getOrganizationScope(organizationId);

  const sources = useMemo(() => resolveSearchSources({
    canViewCatalog,
    canViewMarketplace,
    canViewNetwork,
    canViewWarehouse,
    hasCustomerProfile: hasProfile(profiles, ProfileKind.CUSTOMER),
    hasSupplierProfile: hasProfile(profiles, ProfileKind.SUPPLIER),
    isCustomerVerified: isProfileVerified(profiles, ProfileKind.CUSTOMER),
  }), [canViewCatalog, canViewMarketplace, canViewNetwork, canViewWarehouse, profiles]);

  const isSearchActive = queryKind === 'active' && organizationId !== undefined;
  const isServerQuerySettled = debouncedQuery === normalizedQuery;
  const isDirectoryAvailable = sources.cities || sources.sites !== 'none';

  const directoryOptions = useMemo(() => createNetworkDirectoryQueryOptions(client), [client]);

  const directoryQuery = useQuery({ ...directoryOptions, enabled: isSearchActive && isDirectoryAvailable });

  const organizationsQuery = useQuery({
    meta: { channels: [] },
    queryFn: isSearchActive && sources.organizations ? () => fetchSearchOrganizations(client) : skipToken,
    queryKey: globalSearchKeys.organizations(scope),
    staleTime: ORGANIZATIONS_STALE_TIME_MS,
  });

  const mapSitesQuery = useQuery({
    meta: createOrganizationQueryMeta(organizationId, SITE_EVENT_CASES),
    queryFn: isSearchActive && sources.sites === 'map' ? () => fetchSearchMapSites(client) : skipToken,
    queryKey: networkKeys.mapSites(scope),
  });

  const warehousesQuery = useQuery({
    meta: createOrganizationQueryMeta(organizationId, SITE_EVENT_CASES),
    queryFn: isSearchActive && sources.sites === 'warehouses' ? () => fetchSearchWarehouses(client) : skipToken,
    queryKey: warehouseKeys.list(scope),
  });

  const ownListingsQuery = useQuery({
    meta: createOwnListingQueryMeta(organizationId),
    placeholderData: keepScopedPlaceholder<OwnListingsPageValue>(scope),
    queryFn: isSearchActive && isServerQuerySettled && sources.ownListings
      ? () => fetchOwnListings(client, normalizedQuery, '')
      : skipToken,
    queryKey: globalSearchKeys.ownListings(scope, normalizedQuery),
  });

  const showcaseListingsQuery = useQuery({
    meta: createShowcaseQueryMeta(),
    placeholderData: keepScopedPlaceholder<ShowcasePageValue>(scope),
    queryFn: isSearchActive && isServerQuerySettled && sources.showcaseListings
      ? () => fetchShowcaseListings(client, { query: normalizedQuery, sphereId: '', toWarehouseId: '' }, '')
      : skipToken,
    queryKey: globalSearchKeys.showcaseListings(scope, normalizedQuery),
  });

  const dealsQuery = useQuery({
    meta: createOrganizationQueryMeta(canViewDeals ? organizationId : undefined, ['dealChanged']),
    queryFn: isSearchActive && isServerQuerySettled && canViewDeals
      ? () => import('./findDeals').then(module => module.findDeals(client, normalizedQuery))
      : skipToken,
    queryKey: globalSearchKeys.deals(scope, userId, normalizedQuery),
  });

  const deals = useSearchSourceState(dealsQuery, canViewDeals);
  const directory = useSearchSourceState(directoryQuery, isDirectoryAvailable);
  const organizations = useSearchSourceState(organizationsQuery, sources.organizations);
  const mapSites = useSearchSourceState(mapSitesQuery, sources.sites === 'map');
  const warehouses = useSearchSourceState(warehousesQuery, sources.sites === 'warehouses');
  const ownListings = useSearchSourceState(ownListingsQuery, sources.ownListings);
  const showcaseListings = useSearchSourceState(showcaseListingsQuery, sources.showcaseListings);

  const hasSources = canViewDeals || hasSearchSources(sources);
  const organizationName = organization?.name ?? '';

  const groups = useMemo(() => (
    queryKind === 'active' && hasSources
      ? buildSearchGroups({
          organizationId: organizationId ?? '',
          organizationName,
          query: parsedQuery,
          sources,
          states: { deals, directory, mapSites, organizations, ownListings, showcaseListings, warehouses },
        })
      : NO_GROUPS
  ), [
    deals,
    directory,
    hasSources,
    mapSites,
    organizationId,
    organizationName,
    organizations,
    ownListings,
    parsedQuery,
    queryKind,
    showcaseListings,
    sources,
    warehouses,
  ]);

  const status = resolveSearchStatus({ groups, hasSources, isSourcePending: isOrganizationLoading, queryKind });

  return useMemo(() => ({ groups, normalizedQuery, status }), [groups, normalizedQuery, status]);
};
