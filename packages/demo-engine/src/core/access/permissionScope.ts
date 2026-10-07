export interface EffectivePermissionValue {
  isOrganizationWide: boolean;
  permission: string;
  warehouseIds: readonly string[];
}

export type PermissionScopeValue = Pick<EffectivePermissionValue, 'isOrganizationWide' | 'warehouseIds'>;

export const isWarehouseInScope = (scope: PermissionScopeValue, warehouseId: string): boolean =>
  scope.isOrganizationWide || scope.warehouseIds.includes(warehouseId);
