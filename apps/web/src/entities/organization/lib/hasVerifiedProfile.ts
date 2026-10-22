import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';

const MIN_VERIFIED_LEVEL = 1;

export const hasVerifiedProfile = (profiles: readonly OrganizationProfile[]): boolean => profiles.some(
  profile => profile.verificationLevel >= MIN_VERIFIED_LEVEL,
);
