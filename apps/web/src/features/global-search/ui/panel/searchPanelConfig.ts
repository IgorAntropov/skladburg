import type { LucideIcon } from 'lucide-react';

import {
  Boxes,
  Building,
  Factory,
  MapPin,
  Package,
} from 'lucide-react';

import type { GlobalSearchMessageKeyValue } from '../../i18n/globalSearchSection';
import type {
  SearchGroupIdValue,
  SearchOptionDetailValue,
} from '../../model/searchResultTypes';

export const SEARCH_GROUP_TITLE_KEYS = {
  'cities': 'globalSearch.group.cities',
  'deals': 'globalSearch.group.deals',
  'documents': 'globalSearch.group.documents',
  'organizations': 'globalSearch.group.organizations',
  'own-listings': 'globalSearch.group.ownListings',
  'showcase-listings': 'globalSearch.group.showcaseListings',
  'sites': 'globalSearch.group.sites',
} as const satisfies Record<SearchGroupIdValue, GlobalSearchMessageKeyValue>;

export const SEARCH_GROUP_ICONS = {
  'cities': MapPin,
  'deals': Boxes,
  'documents': Boxes,
  'organizations': Building,
  'own-listings': Boxes,
  'showcase-listings': Package,
  'sites': Factory,
} as const satisfies Record<SearchGroupIdValue, LucideIcon>;

export const SEARCH_OPTION_KIND_KEYS = {
  'city': 'globalSearch.sr.city',
  'deal': 'globalSearch.sr.deal',
  'document': 'globalSearch.sr.document',
  'organization': 'globalSearch.sr.organization',
  'own-listing': 'globalSearch.sr.ownListing',
  'showcase-listing': 'globalSearch.sr.showcaseListing',
  'site': 'globalSearch.sr.site',
} as const satisfies Record<SearchOptionDetailValue['kind'], GlobalSearchMessageKeyValue>;

export const toOptionDomId = (listboxId: string, groupId: SearchGroupIdValue, objectId: string): string => (
  `${listboxId}-${groupId}-${objectId}`
);

export const toGroupHeadingDomId = (listboxId: string, groupId: SearchGroupIdValue): string => (
  `${listboxId}-heading-${groupId}`
);
