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
      canViewMarketplace: true,
      profiles: [profile(ProfileKind.CUSTOMER, 2)],
    })).toEqual({ emptyReason: undefined, isShowcaseVerified: true, tabs: ['showcase'] });
  });

  it('keeps the tab for an unverified customer and marks the showcase as not verified', () => {
    expect(resolveCatalogAccess({
      canViewMarketplace: true,
      profiles: [profile(ProfileKind.CUSTOMER, 0)],
    })).toEqual({ emptyReason: undefined, isShowcaseVerified: false, tabs: ['showcase'] });
  });

  it('does not take the verification of another profile for the verification of the customer', () => {
    const access = resolveCatalogAccess({
      canViewMarketplace: true,
      profiles: [profile(ProfileKind.CUSTOMER, 0), profile(ProfileKind.SUPPLIER, 3)],
    });

    expect(access.isShowcaseVerified).toBe(false);
    expect(access.tabs).toEqual(['showcase']);
  });

  it('explains the missing customer profile of a supplier and a carrier', () => {
    expect(resolveCatalogAccess({
      canViewMarketplace: true,
      profiles: [profile(ProfileKind.SUPPLIER, 3), profile(ProfileKind.CARRIER, 3)],
    })).toEqual({ emptyReason: 'no-customer-profile', isShowcaseVerified: false, tabs: [] });
  });

  it('explains the missing permission of a customer', () => {
    expect(resolveCatalogAccess({
      canViewMarketplace: false,
      profiles: [profile(ProfileKind.CUSTOMER, 3)],
    })).toEqual({ emptyReason: 'no-tabs', isShowcaseVerified: false, tabs: [] });
  });

  it('prefers the missing customer profile over the missing permission', () => {
    expect(resolveCatalogAccess({ canViewMarketplace: false, profiles: [] }).emptyReason).toBe('no-customer-profile');
  });
});
