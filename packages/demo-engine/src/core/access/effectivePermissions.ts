import type { Membership } from '@skladburg/contracts/access/v1/access';

import type { IStateReader } from '../state/index';
import type { EffectivePermissionValue } from './permissionScope';

interface MutableScopeValue {
  isOrganizationWide: boolean;
  warehouseIds: Set<string>;
}

const compareText = (current: string, next: string): number => {
  if (current === next) {
    return 0;
  }

  return current < next ? -1 : 1;
};

export const resolveEffectivePermissions = (read: IStateReader, membership: Membership): EffectivePermissionValue[] => {
  const scopes = new Map<string, MutableScopeValue>();

  for (const assignment of membership.roleAssignments) {
    const role = read.get('roles', assignment.roleId);

    if (role?.tenantId !== membership.organizationId) {
      continue;
    }

    const isAssignmentOrganizationWide = assignment.warehouseIds.length === 0;

    for (const permission of role.permissions) {
      const scope = scopes.get(permission) ?? { isOrganizationWide: false, warehouseIds: new Set<string>() };

      scope.isOrganizationWide = scope.isOrganizationWide || isAssignmentOrganizationWide;

      for (const warehouseId of assignment.warehouseIds) {
        scope.warehouseIds.add(warehouseId);
      }

      scopes.set(permission, scope);
    }
  }

  return [...scopes]
    .sort(([current], [next]) => compareText(current, next))
    .map(([permission, scope]) => ({
      isOrganizationWide: scope.isOrganizationWide,
      permission,
      warehouseIds: scope.isOrganizationWide ? [] : [...scope.warehouseIds].sort(compareText),
    }));
};
