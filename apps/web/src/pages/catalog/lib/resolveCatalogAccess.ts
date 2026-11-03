import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import { isProfileVerified } from '@/entities/organization';

export interface CatalogAccessInputValue {
  canViewCatalog: boolean;
  canViewMarketplace: boolean;
  profiles: readonly OrganizationProfile[];
}

export interface CatalogAccessValue {
  emptyReason: CatalogEmptyReasonValue | undefined;
  isOwnAvailable: boolean;
  isShowcaseVerified: boolean;
  tabs: readonly CatalogTabIdValue[];
}

export type CatalogEmptyReasonValue = 'no-customer-profile' | 'no-tabs';

export type CatalogTabIdValue = 'own' | 'showcase';

export const resolveCatalogAccess = ({
  canViewCatalog,
  canViewMarketplace,
  profiles,
}: CatalogAccessInputValue): CatalogAccessValue => {
  const hasCustomerProfile = profiles.some(profile => profile.kind === ProfileKind.CUSTOMER);
  const hasSupplierProfile = profiles.some(profile => profile.kind === ProfileKind.SUPPLIER);

  const isShowcaseAvailable = hasCustomerProfile && canViewMarketplace;
  const isOwnAvailable = hasSupplierProfile && canViewCatalog;

  const tabs: CatalogTabIdValue[] = [];

  if (isShowcaseAvailable) {
    tabs.push('showcase');
  }

  if (isOwnAvailable) {
    tabs.push('own');
  }

  let emptyReason: CatalogEmptyReasonValue | undefined;

  if (tabs.length === 0) {
    emptyReason = hasCustomerProfile || hasSupplierProfile ? 'no-tabs' : 'no-customer-profile';
  }

  return {
    emptyReason,
    isOwnAvailable,
    isShowcaseVerified: isShowcaseAvailable && isProfileVerified(profiles, ProfileKind.CUSTOMER),
    tabs,
  };
};
