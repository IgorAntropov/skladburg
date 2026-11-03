import type { OrganizationSideValue } from '@/entities/organization';
import type { AppAddressValue } from '@/shared/routing';

export type SearchGroupIdValue = 'cities' | 'organizations' | 'own-listings' | 'showcase-listings' | 'sites';

export const SEARCH_GROUP_ORDER: readonly SearchGroupIdValue[] = [
  'organizations',
  'sites',
  'cities',
  'own-listings',
  'showcase-listings',
];

export type GlobalSearchStatusValue = 'empty' | 'idle' | 'no-sources' | 'ready' | 'searching' | 'too-short';

export interface GlobalSearchValue {
  groups: readonly SearchGroupValue[];
  normalizedQuery: string;
  status: GlobalSearchStatusValue;
}

export interface MatchRangeValue {
  end: number;
  start: number;
}

export type SearchGroupStatusValue = 'error' | 'loading' | 'ready';

export interface SearchGroupValue {
  error: Error | null;
  hasMore: boolean;
  id: SearchGroupIdValue;
  isStale: boolean;
  options: readonly SearchOptionValue[];
  retry: () => void;
  status: SearchGroupStatusValue;
}

export type SearchOptionDetailValue
  = | { cityName: string; isOwn: boolean; kind: 'site'; organizationName: string }
    | { isPublished: boolean; kind: 'own-listing' }
    | { kind: 'city' }
    | { kind: 'organization'; sides: readonly OrganizationSideValue[] }
    | { kind: 'showcase-listing'; supplierName: string };

export interface SearchOptionValue {
  address: AppAddressValue;
  detail: SearchOptionDetailValue;
  detailMatches: readonly MatchRangeValue[];
  groupId: SearchGroupIdValue;
  objectId: string;
  title: string;
  titleMatches: readonly MatchRangeValue[];
}
