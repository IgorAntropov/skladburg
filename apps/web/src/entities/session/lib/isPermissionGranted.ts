import type { EffectivePermission } from '@skladburg/contracts/access/v1/access';
import type { KnownPermissionCode } from '@skladburg/contracts/runtime';

import { getPermissionName } from '@skladburg/contracts/runtime';

import type { PermissionScopeValue } from '../model/permissionScope';

const isGrantedInScope = (permission: EffectivePermission, scope: PermissionScopeValue): boolean => {
  switch (scope.kind) {
    case 'any':
      return true;
    case 'organization':
      return permission.isOrganizationWide;
    case 'warehouse':
      return permission.isOrganizationWide || permission.warehouseIds.includes(scope.warehouseId);
  }
};

export const isPermissionGranted = (
  permissions: readonly EffectivePermission[],
  code: KnownPermissionCode,
  scope: PermissionScopeValue,
): boolean => {
  const name = getPermissionName(code);

  return permissions.some(permission => permission.permission === name && isGrantedInScope(permission, scope));
};
