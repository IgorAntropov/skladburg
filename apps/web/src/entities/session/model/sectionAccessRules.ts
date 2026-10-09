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
    profiles: [ProfileKind.CUSTOMER, ProfileKind.SUPPLIER],
  },
  deals: {
    isOrganizationWideRoleRequired: true,
    permission: undefined,
    profiles: [ProfileKind.SUPPLIER, ProfileKind.CUSTOMER, ProfileKind.CARRIER],
  },
  network: {
    isOrganizationWideRoleRequired: true,
    permission: undefined,
    profiles: [ProfileKind.SUPPLIER, ProfileKind.CUSTOMER, ProfileKind.CARRIER],
  },
  warehouse: {
    isOrganizationWideRoleRequired: false,
    permission: 'warehouse_view',
    profiles: [ProfileKind.CUSTOMER, ProfileKind.SUPPLIER],
  },
};
