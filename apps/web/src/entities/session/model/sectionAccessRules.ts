import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { AppSectionValue } from '@/shared/routing';

export interface SectionAccessRuleValue {
  isOrganizationWideRoleRequired: boolean;
  permission: string | undefined;
  profiles: readonly ProfileKind[];
}

export const SECTION_ACCESS_RULES: Readonly<Record<AppSectionValue, SectionAccessRuleValue>> = {
  catalog: {
    isOrganizationWideRoleRequired: true,
    permission: undefined,
    profiles: [ProfileKind.BUYER, ProfileKind.SELLER],
  },
  deals: {
    isOrganizationWideRoleRequired: true,
    permission: undefined,
    profiles: [ProfileKind.SELLER, ProfileKind.BUYER, ProfileKind.CARRIER],
  },
  network: {
    isOrganizationWideRoleRequired: true,
    permission: undefined,
    profiles: [ProfileKind.SELLER, ProfileKind.BUYER, ProfileKind.CARRIER],
  },
  warehouse: {
    isOrganizationWideRoleRequired: false,
    permission: 'warehouse_view',
    profiles: [ProfileKind.BUYER, ProfileKind.SELLER],
  },
};
