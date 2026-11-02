import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';

import { MIN_VERIFIED_LEVEL } from './verificationLevel';

export const hasVerifiedProfile = (profiles: readonly OrganizationProfile[]): boolean => profiles.some(
  profile => profile.verificationLevel >= MIN_VERIFIED_LEVEL,
);
