import type { KnownPermissionCode } from '@skladburg/contracts/runtime';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';

import type { AppSectionValue } from '@/shared/routing';

import type { PermissionScopeValue } from './permissionScope';

export interface SectionAccessRuleValue {
  permissions: readonly KnownPermissionCode[];
  scope: PermissionScopeValue;
}

export const SECTION_ACCESS_RULES: Readonly<Record<AppSectionValue, SectionAccessRuleValue>> = {
  catalog: { permissions: [PermissionCode.CATALOG_VIEW, PermissionCode.MARKETPLACE_VIEW], scope: { kind: 'any' } },
  deals: { permissions: [PermissionCode.DEAL_VIEW], scope: { kind: 'any' } },
  garage: { permissions: [PermissionCode.FLEET_VIEW], scope: { kind: 'organization' } },
  network: { permissions: [PermissionCode.NETWORK_VIEW], scope: { kind: 'any' } },
  warehouse: { permissions: [PermissionCode.WAREHOUSE_VIEW], scope: { kind: 'any' } },
};
