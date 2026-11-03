import type { OwnListing } from '@skladburg/contracts/catalog/v1/catalog';
import type { ShowcaseListing } from '@skladburg/contracts/catalog/v1/showcase';
import type { MapSite } from '@skladburg/contracts/network/v1/network';
import type {
  OrganizationProfile,
  Warehouse,
} from '@skladburg/contracts/organization/v1/organization';
import type { OrganizationShowcase } from '@skladburg/contracts/organization/v1/showcase';
import type { SearchQueryValue } from '@skladburg/contracts/runtime';

import { isSearchQueryMatched } from '@skladburg/contracts/runtime';

import type { OrganizationSideValue } from '@/entities/organization';
import type { AppAddressValue } from '@/shared/routing';

import { toOrganizationSide } from '@/entities/organization';

import type { SearchOptionValue } from '../model/searchResultTypes';
import type { SearchCandidateValue } from './rankSearchOptions';

import { findMatchRanges } from './findMatchRanges';

export interface SiteCandidateContextValue {
  cityNameById: ReadonlyMap<string, string>;
  organizationId: string;
  query: SearchQueryValue;
}

const toObjectAddress = (id: string, type: 'city' | 'listing' | 'organization' | 'site' | 'warehouse'): AppAddressValue => ({
  kind: 'object',
  object: { id, type },
});

const toSides = (profiles: readonly OrganizationProfile[]): OrganizationSideValue[] => {
  const sides = new Set<OrganizationSideValue>();

  for (const profile of profiles) {
    const side = toOrganizationSide(profile.kind);

    if (side !== undefined) {
      sides.add(side);
    }
  }

  return [...sides];
};

const isGtinMatched = (query: SearchQueryValue, gtin: string): boolean => (
  query.gtin !== undefined && isSearchQueryMatched(query, [], gtin)
);

export const toOrganizationCandidate = (
  organization: OrganizationShowcase,
  query: SearchQueryValue,
): SearchCandidateValue | undefined => {
  if (!isSearchQueryMatched(query, [organization.name])) {
    return undefined;
  }

  const option: SearchOptionValue = {
    address: toObjectAddress(organization.id, 'organization'),
    detail: { kind: 'organization', sides: toSides(organization.profiles) },
    detailMatches: [],
    groupId: 'organizations',
    objectId: organization.id,
    title: organization.name,
    titleMatches: findMatchRanges(organization.name, query),
  };

  return { isGtinMatched: false, option, rankText: organization.name };
};

export const toCityCandidate = (
  nodeId: string,
  cityName: string,
  query: SearchQueryValue,
): SearchCandidateValue | undefined => {
  if (!isSearchQueryMatched(query, [cityName])) {
    return undefined;
  }

  const option: SearchOptionValue = {
    address: toObjectAddress(nodeId, 'city'),
    detail: { kind: 'city' },
    detailMatches: [],
    groupId: 'cities',
    objectId: nodeId,
    title: cityName,
    titleMatches: findMatchRanges(cityName, query),
  };

  return { isGtinMatched: false, option, rankText: cityName };
};

export const toMapSiteCandidate = (
  site: MapSite,
  { cityNameById, organizationId, query }: SiteCandidateContextValue,
): SearchCandidateValue | undefined => {
  const cityName = cityNameById.get(site.cityId);

  if (cityName === undefined) {
    return undefined;
  }

  const isOwn = site.organizationId === organizationId;
  const isNamed = isOwn && site.name !== '';
  const searchableTexts = isNamed ? [site.name, cityName] : [cityName];

  if (!isSearchQueryMatched(query, searchableTexts)) {
    return undefined;
  }

  const title = isNamed ? site.name : site.organizationName;

  const option: SearchOptionValue = {
    address: toObjectAddress(site.id, 'site'),
    detail: { cityName, isOwn, kind: 'site', organizationName: site.organizationName },
    detailMatches: findMatchRanges(cityName, query),
    groupId: 'sites',
    objectId: site.id,
    title,
    titleMatches: isNamed ? findMatchRanges(site.name, query) : [],
  };

  return { isGtinMatched: false, option, rankText: isNamed ? site.name : cityName };
};

export const toWarehouseCandidate = (
  warehouse: Warehouse,
  organizationName: string,
  { cityNameById, query }: Pick<SiteCandidateContextValue, 'cityNameById' | 'query'>,
): SearchCandidateValue | undefined => {
  const cityName = cityNameById.get(warehouse.cityId) ?? '';

  if (!isSearchQueryMatched(query, [warehouse.name, cityName])) {
    return undefined;
  }

  const option: SearchOptionValue = {
    address: toObjectAddress(warehouse.id, 'warehouse'),
    detail: { cityName, isOwn: true, kind: 'site', organizationName },
    detailMatches: findMatchRanges(cityName, query),
    groupId: 'sites',
    objectId: warehouse.id,
    title: warehouse.name,
    titleMatches: findMatchRanges(warehouse.name, query),
  };

  return { isGtinMatched: false, option, rankText: warehouse.name };
};

export const toOwnListingCandidate = (
  item: OwnListing,
  query: SearchQueryValue,
  isStale: boolean,
): SearchCandidateValue | undefined => {
  const { listing, product } = item;

  if (listing === undefined || product === undefined) {
    return undefined;
  }

  if (isStale && !isSearchQueryMatched(query, [product.name, product.sku], product.gtin)) {
    return undefined;
  }

  const option: SearchOptionValue = {
    address: toObjectAddress(listing.id, 'listing'),
    detail: { isPublished: listing.isPublished, kind: 'own-listing' },
    detailMatches: [],
    groupId: 'own-listings',
    objectId: listing.id,
    title: product.name,
    titleMatches: findMatchRanges(product.name, query),
  };

  return { isGtinMatched: isGtinMatched(query, product.gtin), option, rankText: product.name };
};

export const toShowcaseListingCandidate = (
  listing: ShowcaseListing,
  query: SearchQueryValue,
  isStale: boolean,
): SearchCandidateValue | undefined => {
  const supplierName = listing.supplier?.name ?? '';

  if (isStale && !isSearchQueryMatched(query, [listing.productName, supplierName], listing.gtin)) {
    return undefined;
  }

  const option: SearchOptionValue = {
    address: toObjectAddress(listing.id, 'listing'),
    detail: { kind: 'showcase-listing', supplierName },
    detailMatches: findMatchRanges(supplierName, query),
    groupId: 'showcase-listings',
    objectId: listing.id,
    title: listing.productName,
    titleMatches: findMatchRanges(listing.productName, query),
  };

  return { isGtinMatched: isGtinMatched(query, listing.gtin), option, rankText: listing.productName };
};
