import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import {
  OrganizationProfileSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveCatalogAccess } from './resolveCatalogAccess';

const profile = (kind: ProfileKind, verificationLevel: number): OrganizationProfile => (
  create(OrganizationProfileSchema, { kind, verificationLevel })
);

describe('resolveCatalogAccess', () => {
  it('opens the showcase to a verified customer who may view the marketplace', () => {
    expect(resolveCatalogAccess({
      canViewCatalog: false,
      canViewMarketplace: true,
      profiles: [profile(ProfileKind.CUSTOMER, 2)],
    })).toEqual({ emptyReason: undefined, isOwnAvailable: false, isShowcaseVerified: true, tabs: ['showcase'] });
  });

  it('keeps the tab for an unverified customer and marks the showcase as not verified', () => {
    expect(resolveCatalogAccess({
      canViewCatalog: false,
      canViewMarketplace: true,
      profiles: [profile(ProfileKind.CUSTOMER, 0)],
    })).toEqual({ emptyReason: undefined, isOwnAvailable: false, isShowcaseVerified: false, tabs: ['showcase'] });
  });

  it('does not take the verification of another profile for the verification of the customer', () => {
    const access = resolveCatalogAccess({
      canViewCatalog: false,
      canViewMarketplace: true,
      profiles: [profile(ProfileKind.CUSTOMER, 0), profile(ProfileKind.SUPPLIER, 3)],
    });

    expect(access.isShowcaseVerified).toBe(false);
    expect(access.tabs).toEqual(['showcase']);
  });

  it('opens the own catalog to a supplier who may view the catalog, verified or not', () => {
    expect(resolveCatalogAccess({
      canViewCatalog: true,
      canViewMarketplace: false,
      profiles: [profile(ProfileKind.SUPPLIER, 0)],
    })).toEqual({ emptyReason: undefined, isOwnAvailable: true, isShowcaseVerified: false, tabs: ['own'] });
  });

  it('gives a supplier who is also a carrier the own catalog only', () => {
    const access = resolveCatalogAccess({
      canViewCatalog: true,
      canViewMarketplace: true,
      profiles: [profile(ProfileKind.SUPPLIER, 3), profile(ProfileKind.CARRIER, 3)],
    });

    expect(access.tabs).toEqual(['own']);
    expect(access.isShowcaseVerified).toBe(false);
  });

  it('gives a company with both profiles the showcase first and the own catalog second', () => {
    const access = resolveCatalogAccess({
      canViewCatalog: true,
      canViewMarketplace: true,
      profiles: [profile(ProfileKind.SUPPLIER, 3), profile(ProfileKind.CUSTOMER, 3)],
    });

    expect(access.tabs).toEqual(['showcase', 'own']);
    expect(access.isOwnAvailable).toBe(true);
    expect(access.isShowcaseVerified).toBe(true);
  });

  it('keeps the own catalog when only the marketplace permission is missing', () => {
    const access = resolveCatalogAccess({
      canViewCatalog: true,
      canViewMarketplace: false,
      profiles: [profile(ProfileKind.SUPPLIER, 3), profile(ProfileKind.CUSTOMER, 3)],
    });

    expect(access.tabs).toEqual(['own']);
    expect(access.isShowcaseVerified).toBe(false);
  });

  it('explains the missing customer profile of a carrier', () => {
    expect(resolveCatalogAccess({
      canViewCatalog: true,
      canViewMarketplace: true,
      profiles: [profile(ProfileKind.CARRIER, 3)],
    })).toEqual({ emptyReason: 'no-customer-profile', isOwnAvailable: false, isShowcaseVerified: false, tabs: [] });
  });

  it('explains the missing permission of a customer', () => {
    expect(resolveCatalogAccess({
      canViewCatalog: true,
      canViewMarketplace: false,
      profiles: [profile(ProfileKind.CUSTOMER, 3)],
    })).toEqual({ emptyReason: 'no-tabs', isOwnAvailable: false, isShowcaseVerified: false, tabs: [] });
  });

  it('explains the missing permission of a supplier', () => {
    expect(resolveCatalogAccess({
      canViewCatalog: false,
      canViewMarketplace: true,
      profiles: [profile(ProfileKind.SUPPLIER, 3)],
    }).emptyReason).toBe('no-tabs');
  });

  it('prefers the missing customer profile over the missing permission when there are no profiles', () => {
    expect(resolveCatalogAccess({ canViewCatalog: false, canViewMarketplace: false, profiles: [] }).emptyReason)
      .toBe('no-customer-profile');
  });
});
