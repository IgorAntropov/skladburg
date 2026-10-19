import type { KnownPermissionCode } from '@skladburg/contracts/runtime';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';

import type { AppSectionValue } from '@/shared/routing';

export interface SectionAccessRuleValue {
  permissions: readonly KnownPermissionCode[];
}

export const SECTION_ACCESS_RULES: Readonly<Record<AppSectionValue, SectionAccessRuleValue>> = {
  catalog: { permissions: [PermissionCode.CATALOG_VIEW, PermissionCode.MARKETPLACE_VIEW] },
  deals: { permissions: [PermissionCode.DEAL_VIEW] },
  network: { permissions: [PermissionCode.NETWORK_VIEW] },
  warehouse: { permissions: [PermissionCode.WAREHOUSE_VIEW] },
};
