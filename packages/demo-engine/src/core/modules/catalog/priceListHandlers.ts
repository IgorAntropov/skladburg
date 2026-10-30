import type { ServiceImpl } from '@connectrpc/connect';

import {
  clone,
  create,
} from '@bufbuild/protobuf';
import {
  CatalogService,
  GetPriceListResponseSchema,
  PriceListSchema,
  SavePriceListResponseSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';

import type { IModuleRuntime } from '../moduleRuntime';
import type { PublishCatalogChangeFunction } from './catalogEvents';

import {
  findPriceList,
  hasPublishedListing,
} from './catalogRecords';
import { assertVersionOrInitial } from './versionedRecords';

export type PriceListHandlersValue = Pick<ServiceImpl<typeof CatalogService>, 'getPriceList' | 'savePriceList'>;

export const createPriceListHandlers = (runtime: IModuleRuntime, publishChange: PublishCatalogChangeFunction): PriceListHandlersValue => {
  const {
    command,
    errors,
    guard,
    idempotency,
    random,
    read,
  } = runtime;

  return {
    getPriceList: (request, context) => {
      const caller = guard.guardPermissionCall(read, CatalogService.method.getPriceList, request, context.requestHeader);
      const priceList = findPriceList(read, caller.organizationId)
        ?? create(PriceListSchema, { tenantId: caller.organizationId });

      return create(GetPriceListResponseSchema, { priceList });
    },
    savePriceList: (request, context) => command((transaction) => {
      const caller = guard.guardPermissionCall(transaction, CatalogService.method.savePriceList, request, context.requestHeader);

      return idempotency.run(transaction, {
        handler: () => {
          const organizationId = caller.organizationId;
          const current = findPriceList(transaction, organizationId);

          assertVersionOrInitial(errors, EntityKind.PRICE_LIST, current?.version ?? 0n, request.expectedVersion);

          const priceList = create(PriceListSchema, {
            id: current?.id ?? random.uuid(),
            tenantId: organizationId,
            validUntil: request.validUntil === undefined ? undefined : clone(CalendarDateSchema, request.validUntil),
            version: (current?.version ?? 0n) + 1n,
          });

          transaction.put('priceLists', priceList);
          publishChange(transaction, organizationId, hasPublishedListing(transaction, organizationId));

          return create(SavePriceListResponseSchema, { priceList });
        },
        idempotencyKey: request.idempotencyKey,
        method: CatalogService.method.savePriceList,
        request,
        scope: caller.organizationId,
      });
    }),
  };
};
