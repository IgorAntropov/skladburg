import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import {
  CatalogService,
  SetListingPublishedResponseSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';

import type { IModuleRuntime } from '../moduleRuntime';
import type { PublishCatalogChangeFunction } from './catalogEvents';

import { collectPublicationViolations } from './catalogRules';
import {
  assertExpectedVersion,
  readOwned,
} from './versionedRecords';

export type PublicationHandlersValue = Pick<ServiceImpl<typeof CatalogService>, 'setListingPublished'>;

export const createPublicationHandlers = (
  runtime: IModuleRuntime,
  publishChange: PublishCatalogChangeFunction,
): PublicationHandlersValue => {
  const {
    command,
    errors,
    guard,
    idempotency,
  } = runtime;

  return {
    setListingPublished: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, CatalogService.method.setListingPublished, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const organizationId = caller.organizationId;
          const listing = readOwned(errors, EntityKind.LISTING, transaction.get('listings', request.listingId), organizationId);

          assertExpectedVersion(errors, EntityKind.LISTING, listing, request.expectedVersion);

          if (request.isPublished) {
            const violations = collectPublicationViolations({
              availabilityCount: listing.availability.length,
              hasPrice: (transaction.get('listingPrices', listing.id)?.tiers.length ?? 0) > 0,
            });

            if (violations.length > 0) {
              throw errors.validationFailed(violations);
            }
          }

          const isChanged = listing.isPublished !== request.isPublished;

          if (isChanged) {
            listing.isPublished = request.isPublished;
            listing.version += 1n;
            transaction.put('listings', listing);
          }

          publishChange(transaction, organizationId, isChanged);

          return create(SetListingPublishedResponseSchema, { listing });
        },
        idempotencyKey: request.idempotencyKey,
        method: CatalogService.method.setListingPublished,
        request,
        scope: caller.organizationId,
      });
    }),
  };
};
