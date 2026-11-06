import type { SearchQueryValue } from '@skladburg/contracts/runtime';

import type {
  SearchGroupIdValue,
  SearchGroupStatusValue,
  SearchGroupValue,
} from '../model/searchResultTypes';
import type {
  SearchSourceStatesValue,
  SearchSourceStateValue,
} from '../model/searchSourceTypes';
import type { SearchCandidateValue } from './rankSearchOptions';
import type { SearchSourcesValue } from './resolveSearchSources';

import {
  toCityCandidate,
  toMapSiteCandidate,
  toOrganizationCandidate,
  toOwnListingCandidate,
  toShowcaseListingCandidate,
  toWarehouseCandidate,
} from './buildSearchOptions';
import { rankSearchOptions } from './rankSearchOptions';

export interface BuildSearchGroupsInputValue {
  organizationId: string;
  organizationName: string;
  query: SearchQueryValue;
  sources: SearchSourcesValue;
  states: SearchSourceStatesValue;
}

interface CombinedStateValue {
  error: Error | null;
  isStale: boolean;
  retry: () => void;
  status: SearchGroupStatusValue;
}

interface GroupDraftValue {
  candidates: readonly SearchCandidateValue[];
  hasNextPage: boolean;
}

const combineStates = (states: readonly SearchSourceStateValue<unknown>[]): CombinedStateValue => {
  const failed = states.filter(state => state.status === 'error');
  const isLoading = states.some(state => state.status === 'loading');

  const retry = (): void => {
    for (const state of failed) {
      state.retry();
    }
  };

  if (failed.length > 0) {
    return { error: failed[0]?.error ?? null, isStale: false, retry, status: 'error' };
  }

  const isStale = !isLoading && states.some(state => state.isStale);

  return { error: null, isStale, retry, status: isLoading ? 'loading' : 'ready' };
};

const toCandidates = <TItem>(
  items: readonly TItem[],
  toCandidate: (item: TItem) => SearchCandidateValue | undefined,
): SearchCandidateValue[] => items.flatMap((item) => {
  const candidate = toCandidate(item);

  return candidate === undefined ? [] : [candidate];
});

const assembleGroup = (
  id: SearchGroupIdValue,
  sources: readonly SearchSourceStateValue<unknown>[],
  query: SearchQueryValue,
  createDraft: (isStale: boolean) => GroupDraftValue,
): SearchGroupValue | undefined => {
  const { error, isStale, retry, status } = combineStates(sources);

  if (status !== 'ready') {
    return { error, hasMore: false, id, isStale: false, options: [], retry, status };
  }

  const { candidates, hasNextPage } = createDraft(isStale);
  const { hasMore, options } = rankSearchOptions({ candidates, hasNextPage, query });

  if (options.length > 0) {
    return { error: null, hasMore, id, isStale, options, retry, status };
  }

  return isStale ? { error: null, hasMore: false, id, isStale: false, options: [], retry, status: 'loading' } : undefined;
};

const hasNextPageToken = (page: undefined | { nextPageToken: string }): boolean => (page?.nextPageToken ?? '') !== '';

export const buildSearchGroups = ({
  organizationId,
  organizationName,
  query,
  sources,
  states,
}: BuildSearchGroupsInputValue): SearchGroupValue[] => {
  const { deals, directory, mapSites, organizations, ownListings, showcaseListings, warehouses } = states;
  const groups: (SearchGroupValue | undefined)[] = [];

  const cityNameById: ReadonlyMap<string, string> = new Map(
    (directory?.data?.cities ?? []).map(city => [city.id, city.name]),
  );

  if (sources.organizations && organizations !== undefined) {
    groups.push(assembleGroup('organizations', [organizations], query, () => ({
      candidates: toCandidates(organizations.data ?? [], organization => toOrganizationCandidate(organization, query)),
      hasNextPage: false,
    })));
  }

  if (sources.sites === 'map' && mapSites !== undefined && directory !== undefined) {
    groups.push(assembleGroup('sites', [mapSites, directory], query, () => ({
      candidates: toCandidates(
        mapSites.data ?? [],
        site => toMapSiteCandidate(site, { cityNameById, organizationId, query }),
      ),
      hasNextPage: false,
    })));
  }

  if (sources.sites === 'warehouses' && warehouses !== undefined && directory !== undefined) {
    groups.push(assembleGroup('sites', [warehouses, directory], query, () => ({
      candidates: toCandidates(
        warehouses.data ?? [],
        warehouse => toWarehouseCandidate(warehouse, organizationName, { cityNameById, query }),
      ),
      hasNextPage: false,
    })));
  }

  if (sources.cities && directory !== undefined) {
    groups.push(assembleGroup('cities', [directory], query, () => ({
      candidates: toCandidates(directory.data?.mapNodes ?? [], (node) => {
        const cityName = cityNameById.get(node.cityId);

        return cityName === undefined ? undefined : toCityCandidate(node.id, cityName, query);
      }),
      hasNextPage: false,
    })));
  }

  if (sources.ownListings && ownListings !== undefined) {
    groups.push(assembleGroup('own-listings', [ownListings], query, isStale => ({
      candidates: toCandidates(ownListings.data?.items ?? [], item => toOwnListingCandidate(item, query, isStale)),
      hasNextPage: hasNextPageToken(ownListings.data),
    })));
  }

  if (sources.showcaseListings && showcaseListings !== undefined) {
    groups.push(assembleGroup('showcase-listings', [showcaseListings], query, isStale => ({
      candidates: toCandidates(showcaseListings.data?.items ?? [], item => toShowcaseListingCandidate(item, query, isStale)),
      hasNextPage: hasNextPageToken(showcaseListings.data),
    })));
  }

  if (deals !== undefined) {
    groups.push(assembleGroup('deals', [deals], query, () => deals.data ?? { candidates: [], hasNextPage: false }));
  }

  return groups.filter(group => group !== undefined);
};
