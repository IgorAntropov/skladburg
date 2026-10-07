import type { Role } from '@skladburg/contracts/access/v1/access';
import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import type { PermissionScopeValue } from '../access/index';
import type { IStateReader } from '../state/index';

import { isWarehouseInScope } from '../access/index';

export const listVisibleWarehouses = (read: IStateReader, tenantId: string, scope: PermissionScopeValue): Warehouse[] =>
  read.listBy('warehouses', 'tenantId', tenantId).filter(warehouse => isWarehouseInScope(scope, warehouse.id));

export const listVisibleRoles = (read: IStateReader, tenantId: string): Role[] => read.listBy('roles', 'tenantId', tenantId);
