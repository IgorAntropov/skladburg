import type { Membership } from '@skladburg/contracts/access/v1/access';

import type { IStateReader } from '../state/index';
import type { PermissionGrantValue } from './permissionGrants';
import type { EffectivePermissionValue } from './permissionScope';

import { compareIds } from '../state/index';
import { resolvePermissionGrants } from './permissionGrants';

interface MutableScopeValue {
  isOrganizationWide: boolean;
  warehouseIds: Set<string>;
}

export const summarizePermissionGrants = (grants: readonly PermissionGrantValue[]): EffectivePermissionValue[] => {
  const scopes = new Map<string, MutableScopeValue>();

  for (const grant of grants) {
    const scope = scopes.get(grant.permission) ?? { isOrganizationWide: false, warehouseIds: new Set<string>() };

    scope.isOrganizationWide = scope.isOrganizationWide || grant.isOrganizationWide;

    for (const warehouseId of grant.warehouseIds) {
      scope.warehouseIds.add(warehouseId);
    }

    scopes.set(grant.permission, scope);
  }

  return [...scopes]
    .sort(([current], [next]) => compareIds(current, next))
    .map(([permission, scope]) => ({
      isOrganizationWide: scope.isOrganizationWide,
      permission,
      warehouseIds: scope.isOrganizationWide ? [] : [...scope.warehouseIds].sort(compareIds),
    }));
};

export const resolveEffectivePermissions = (read: IStateReader, membership: Membership): EffectivePermissionValue[] =>
  summarizePermissionGrants(resolvePermissionGrants(read, membership));
