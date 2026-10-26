import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';

import type { OrganizationLogoValue } from '@/entities/organization';

export interface OrganizationCardValue {
  id: string;
  logo?: OrganizationLogoValue | undefined;
  name: string;
  profiles: readonly OrganizationProfile[];
  sphereNames: readonly string[];
}
