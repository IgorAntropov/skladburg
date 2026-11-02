import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import { isProfileVerified } from '@/entities/organization';

export interface CatalogAccessInputValue {
  canViewMarketplace: boolean;
  profiles: readonly OrganizationProfile[];
}

export interface CatalogAccessValue {
  emptyReason: CatalogEmptyReasonValue | undefined;
  isShowcaseVerified: boolean;
  tabs: readonly CatalogTabIdValue[];
}

export type CatalogEmptyReasonValue = 'no-customer-profile' | 'no-tabs';

export type CatalogTabIdValue = 'showcase';

const SHOWCASE_TABS: readonly CatalogTabIdValue[] = ['showcase'];

const NO_TABS: readonly CatalogTabIdValue[] = [];

export const resolveCatalogAccess = ({ canViewMarketplace, profiles }: CatalogAccessInputValue): CatalogAccessValue => {
  const hasCustomerProfile = profiles.some(profile => profile.kind === ProfileKind.CUSTOMER);
  const tabs = hasCustomerProfile && canViewMarketplace ? SHOWCASE_TABS : NO_TABS;

  let emptyReason: CatalogEmptyReasonValue | undefined;

  if (tabs.length === 0) {
    emptyReason = hasCustomerProfile ? 'no-tabs' : 'no-customer-profile';
  }

  return {
    emptyReason,
    isShowcaseVerified: tabs.includes('showcase') && isProfileVerified(profiles, ProfileKind.CUSTOMER),
    tabs,
  };
};
