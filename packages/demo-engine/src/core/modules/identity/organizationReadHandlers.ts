import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  GetOrganizationResponseSchema,
  GetOrganizationSettingsResponseSchema,
  ListSpheresResponseSchema,
  OrganizationService,
} from '@skladburg/contracts/organization/v1/organization';

import type { IModuleRuntime } from '../moduleRuntime';

import { getVisibleOrganization } from '../../visibility/index';
import { paginate } from '../pagination';

export type OrganizationReadHandlersValue = Pick<
  ServiceImpl<typeof OrganizationService>,
  'getOrganization' | 'getOrganizationSettings' | 'listSpheres'
>;

export const createOrganizationReadHandlers = (runtime: IModuleRuntime): OrganizationReadHandlersValue => {
  const { errors, guard, read } = runtime;

  return {
    getOrganization: (request, context) => {
      const caller = guard.guardMemberCall(read, OrganizationService.method.getOrganization, request, context.requestHeader);
      const organization = getVisibleOrganization(read, caller.organizationId, request.organizationId);

      if (organization === undefined) {
        throw errors.notFound(EntityKind.ORGANIZATION);
      }

      return create(GetOrganizationResponseSchema, { organization });
    },
    getOrganizationSettings: (request, context) => {
      const caller = guard.guardMemberCall(read, OrganizationService.method.getOrganizationSettings, request, context.requestHeader);
      const settings = read.get('organizationSettings', caller.organizationId);

      if (settings === undefined) {
        throw errors.notFound(EntityKind.ORGANIZATION);
      }

      return create(GetOrganizationSettingsResponseSchema, { settings });
    },
    listSpheres: (request, context) => {
      guard.guardCall(read, OrganizationService.method.listSpheres, request, context.requestHeader);
      const { items, page } = paginate(read.list('spheres'), sphere => sphere.id, request.page, errors);

      return create(ListSpheresResponseSchema, { page, spheres: items });
    },
  };
};
