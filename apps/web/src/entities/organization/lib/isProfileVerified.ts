import type {
  OrganizationProfile,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';

import { MIN_VERIFIED_LEVEL } from './verificationLevel';

export const isProfileVerified = (profiles: readonly OrganizationProfile[], kind: ProfileKind): boolean => profiles.some(
  profile => profile.kind === kind && profile.verificationLevel >= MIN_VERIFIED_LEVEL,
);
