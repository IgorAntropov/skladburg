import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  GetOrganizationRequisitesResponseSchema,
  OrganizationRequisitesService,
} from '@skladburg/contracts/organization/v1/requisites';

import type { IModuleRuntime } from '../moduleRuntime';

export const createOrganizationRequisitesService = (runtime: IModuleRuntime): ServiceImpl<typeof OrganizationRequisitesService> => {
  const { errors, guard, read } = runtime;

  return {
    getOrganizationRequisites: (request, context) => {
      const caller = guard.guardMemberCall(
        read,
        OrganizationRequisitesService.method.getOrganizationRequisites,
        request,
        context.requestHeader,
      );
      const requisites = read.get('organizationRequisites', caller.organizationId);

      if (requisites === undefined) {
        throw errors.notFound(EntityKind.ORGANIZATION);
      }

      return create(GetOrganizationRequisitesResponseSchema, { requisites });
    },
  };
};
