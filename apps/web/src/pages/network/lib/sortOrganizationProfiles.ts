import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

const PROFILE_KIND_ORDER: readonly ProfileKind[] = [ProfileKind.CUSTOMER, ProfileKind.SUPPLIER, ProfileKind.CARRIER];

export const sortOrganizationProfiles = (profiles: readonly OrganizationProfile[]): OrganizationProfile[] => PROFILE_KIND_ORDER.flatMap(
  kind => profiles.filter(profile => profile.kind === kind),
);
