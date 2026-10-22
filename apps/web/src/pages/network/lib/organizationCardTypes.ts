import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';

export interface OrganizationCardValue {
  id: string;
  name: string;
  profiles: readonly OrganizationProfile[];
  sphereNames: readonly string[];
}
