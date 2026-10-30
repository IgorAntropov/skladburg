import type { ServiceImpl } from '@connectrpc/connect';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  CatalogService,
  GetSalesTermsResponseSchema,
  OwnDeliveryTermsSchema,
  SalesTermsSchema,
  SaveSalesTermsResponseSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';

import type { IModuleRuntime } from '../moduleRuntime';
import type { PublishCatalogChangeFunction } from './catalogEvents';

import { hasPublishedListing } from './catalogRecords';
import { collectSalesTermsViolations } from './catalogRules';
import { assertVersionOrInitial } from './versionedRecords';

export type SalesTermsHandlersValue = Pick<ServiceImpl<typeof CatalogService>, 'getSalesTerms' | 'saveSalesTerms'>;

const DEFAULT_PREPARATION_WORKING_DAYS = 1;

export const createSalesTermsHandlers = (runtime: IModuleRuntime, publishChange: PublishCatalogChangeFunction): SalesTermsHandlersValue => {
  const {
    command,
    errors,
    guard,
    idempotency,
    read,
  } = runtime;

  return {
    getSalesTerms: (request, context) => {
      const caller = guard.guardPermissionCall(read, CatalogService.method.getSalesTerms, request, context.requestHeader);
      const terms = read.get('salesTerms', caller.organizationId) ?? create(SalesTermsSchema, {
        organizationId: caller.organizationId,
        preparationWorkingDays: DEFAULT_PREPARATION_WORKING_DAYS,
      });

      return create(GetSalesTermsResponseSchema, { terms });
    },
    saveSalesTerms: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, CatalogService.method.saveSalesTerms, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const organizationId = caller.organizationId;
          const current = transaction.get('salesTerms', organizationId);

          assertVersionOrInitial(errors, EntityKind.ORGANIZATION, current?.version ?? 0n, request.expectedVersion);

          const violations = collectSalesTermsViolations(request.ownDelivery);

          if (violations.length > 0) {
            throw errors.validationFailed(violations);
          }

          const terms = create(SalesTermsSchema, {
            isAutoConfirmEnabled: request.isAutoConfirmEnabled,
            organizationId,
            ownDelivery: request.ownDelivery === undefined ? undefined : clone(OwnDeliveryTermsSchema, request.ownDelivery),
            preparationWorkingDays: request.preparationWorkingDays,
            version: (current?.version ?? 0n) + 1n,
          });

          transaction.put('salesTerms', terms);
          publishChange(transaction, organizationId, hasPublishedListing(transaction, organizationId));

          return create(SaveSalesTermsResponseSchema, { terms });
        },
        idempotencyKey: request.idempotencyKey,
        method: CatalogService.method.saveSalesTerms,
        request,
        scope: caller.organizationId,
      });
    }),
  };
};
