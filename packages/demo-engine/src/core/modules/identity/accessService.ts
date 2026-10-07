import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import {
  AccessService,
  type EffectivePermission,
  EffectivePermissionSchema,
  GetSessionResponseSchema,
  ListPermissionsResponseSchema,
  ListRolesResponseSchema,
} from '@skladburg/contracts/access/v1/access';

import type { EffectivePermissionValue } from '../../access/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { ENGINE_SERVICES } from '../../access/index';
import {
  getVisibleOrganization,
  listVisibleRoles,
} from '../../visibility/index';
import { paginate } from '../pagination';
import { buildPermissionCatalog } from './permissionCatalog';

const toEffectivePermission = (effective: EffectivePermissionValue): EffectivePermission =>
  create(EffectivePermissionSchema, {
    isOrganizationWide: effective.isOrganizationWide,
    permission: effective.permission,
    warehouseIds: [...effective.warehouseIds],
  });

export const createAccessService = (runtime: IModuleRuntime): ServiceImpl<typeof AccessService> => {
  const { errors, guard, read } = runtime;
  const permissionCatalog = buildPermissionCatalog(ENGINE_SERVICES);

  return {
    getSession: (request, context) => {
      const caller = guard.guardCall(read, AccessService.method.getSession, request, context.requestHeader);
      const memberships = read.listBy('memberships', 'userId', caller.user.id);

      return create(GetSessionResponseSchema, {
        actingOrganizationId: caller.organizationId ?? '',
        memberships,
        organizations: memberships.flatMap((membership) => {
          const organization = getVisibleOrganization(read, membership.organizationId, membership.organizationId);

          return organization === undefined ? [] : [organization];
        }),
        permissions: caller.permissions.map(toEffectivePermission),
        user: caller.user,
      });
    },
    listPermissions: (request, context) => {
      guard.guardCall(read, AccessService.method.listPermissions, request, context.requestHeader);
      const { items, page } = paginate(permissionCatalog, permission => permission.name, request.page, errors);

      return create(ListPermissionsResponseSchema, { page, permissions: items });
    },
    listRoles: (request, context) => {
      const caller = guard.guardMemberCall(read, AccessService.method.listRoles, request, context.requestHeader);
      const { items, page } = paginate(listVisibleRoles(read, caller.organizationId), role => role.id, request.page, errors);

      return create(ListRolesResponseSchema, { page, roles: items });
    },
  };
};
