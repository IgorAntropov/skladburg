import type { Membership } from '@skladburg/contracts/access/v1/access';
import type { Money } from '@skladburg/contracts/common/v1/money';

import type { IStateReader } from '../state/index';

export interface PermissionGrantValue {
  amountLimit: Money | undefined;
  isOrganizationWide: boolean;
  permission: string;
  warehouseIds: readonly string[];
}

export const resolvePermissionGrants = (read: IStateReader, membership: Membership): PermissionGrantValue[] =>
  membership.roleAssignments.flatMap((assignment) => {
    const role = read.get('roles', assignment.roleId);

    if (role?.tenantId !== membership.organizationId) {
      return [];
    }

    return role.permissions.map(permission => ({
      amountLimit: assignment.amountLimit,
      isOrganizationWide: assignment.warehouseIds.length === 0,
      permission,
      warehouseIds: [...assignment.warehouseIds],
    }));
  });
