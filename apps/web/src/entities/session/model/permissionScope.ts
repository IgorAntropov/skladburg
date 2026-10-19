export type PermissionScopeValue
  = | { kind: 'any' }
    | { kind: 'organization' }
    | { kind: 'warehouse'; warehouseId: string };
