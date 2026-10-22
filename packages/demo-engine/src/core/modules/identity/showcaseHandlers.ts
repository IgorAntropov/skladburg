import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  GetOrganizationShowcaseResponseSchema,
  ListOrganizationShowcasesResponseSchema,
  OrganizationShowcaseService,
} from '@skladburg/contracts/organization/v1/showcase';

import type { IModuleRuntime } from '../moduleRuntime';

import {
  getVisibleOrganizationShowcase,
  listVisibleOrganizationShowcases,
} from '../../visibility/index';
import { paginate } from '../pagination';

export const createOrganizationShowcaseService = (runtime: IModuleRuntime): ServiceImpl<typeof OrganizationShowcaseService> => {
  const { errors, guard, read } = runtime;

  return {
    getOrganizationShowcase: (request, context) => {
      const caller = guard.guardPermissionCall(
        read,
        OrganizationShowcaseService.method.getOrganizationShowcase,
        request,
        context.requestHeader,
      );
      const organization = getVisibleOrganizationShowcase(read, caller.organizationId, request.organizationId);

      if (organization === undefined) {
        throw errors.notFound(EntityKind.ORGANIZATION);
      }

      return create(GetOrganizationShowcaseResponseSchema, { organization });
    },
    listOrganizationShowcases: (request, context) => {
      const caller = guard.guardPermissionCall(
        read,
        OrganizationShowcaseService.method.listOrganizationShowcases,
        request,
        context.requestHeader,
      );
      const showcases = listVisibleOrganizationShowcases(read, caller.organizationId, {
        minVerificationLevel: request.minVerificationLevel,
        profileKind: request.profileKind,
        sphereId: request.sphereId,
      });
      const { items, page } = paginate(showcases, showcase => showcase.id, request.page, errors);

      return create(ListOrganizationShowcasesResponseSchema, { organizations: items, page });
    },
  };
};
