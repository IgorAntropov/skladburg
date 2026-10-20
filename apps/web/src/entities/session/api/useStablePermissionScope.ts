import { useMemo } from 'react';

import type { PermissionScopeValue } from '../model/permissionScope';

export const ANY_PERMISSION_SCOPE: PermissionScopeValue = { kind: 'any' };

export const useStablePermissionScope = (scope: PermissionScopeValue): PermissionScopeValue => {
  const scopeKind = scope.kind;
  const warehouseId = scope.kind === 'warehouse' ? scope.warehouseId : undefined;

  return useMemo((): PermissionScopeValue => {
    if (warehouseId !== undefined) {
      return { kind: 'warehouse', warehouseId };
    }

    return scopeKind === 'organization' ? { kind: 'organization' } : ANY_PERMISSION_SCOPE;
  }, [scopeKind, warehouseId]);
};
