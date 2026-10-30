import type { ServiceImpl } from '@connectrpc/connect';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  BankAccountSchema,
  GetOrganizationRequisitesResponseSchema,
  OrganizationRequisitesSchema,
  OrganizationRequisitesService,
  UpdateOrganizationRequisitesResponseSchema,
} from '@skladburg/contracts/organization/v1/requisites';

import type { IModuleRuntime } from '../moduleRuntime';

import { createSignatoryHandlers } from './signatoryHandlers';

export const createOrganizationRequisitesService = (runtime: IModuleRuntime): ServiceImpl<typeof OrganizationRequisitesService> => {
  const {
    command,
    errors,
    guard,
    idempotency,
    read,
  } = runtime;

  return {
    ...createSignatoryHandlers(runtime),
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
    updateOrganizationRequisites: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(
        transaction,
        OrganizationRequisitesService.method.updateOrganizationRequisites,
        request,
        context.requestHeader,
      );

      return idempotency.run(transaction, {
        handler: () => {
          const current = transaction.get('organizationRequisites', caller.organizationId);

          if (current === undefined) {
            throw errors.notFound(EntityKind.ORGANIZATION);
          }

          if (current.version !== request.expectedVersion) {
            throw errors.versionConflict(EntityKind.ORGANIZATION, Number(current.version));
          }

          if (request.bank === undefined) {
            throw errors.validationFailed([{ fieldPath: 'bank', ruleId: 'required' }]);
          }

          const requisites = clone(OrganizationRequisitesSchema, current);

          requisites.legalAddress = request.legalAddress;
          requisites.vatMode = request.vatMode;
          requisites.bank = clone(BankAccountSchema, request.bank);
          requisites.version = current.version + 1n;
          transaction.put('organizationRequisites', requisites);

          return create(UpdateOrganizationRequisitesResponseSchema, { requisites });
        },
        idempotencyKey: request.idempotencyKey,
        method: OrganizationRequisitesService.method.updateOrganizationRequisites,
        request,
        scope: caller.organizationId,
      });
    }),
  };
};
