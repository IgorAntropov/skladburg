import { getOrganizationScope } from '@/shared/api';

export interface WarehouseWorkspaceScopeValue {
  organizationId: string | undefined;
  userId: string | undefined;
  warehouseId: string | undefined;
}

export const warehouseWorkspaceKey = ({ organizationId, userId, warehouseId }: WarehouseWorkspaceScopeValue): readonly string[] =>
  ['warehouse-workspace', getOrganizationScope(organizationId), userId ?? '', warehouseId ?? ''];
