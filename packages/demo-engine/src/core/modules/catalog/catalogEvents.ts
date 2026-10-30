import type { Event } from '@skladburg/contracts/event/v1/event';

import { create } from '@bufbuild/protobuf';
import { ListingsChangedSchema } from '@skladburg/contracts/catalog/v1/catalog_events';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  marketChannel,
  organizationChannel,
} from '@skladburg/contracts/runtime';

import type { IStateTransaction } from '../../state/index';
import type { IEventOutbox } from '../moduleRuntime';

import { isProfileVerified } from '../../visibility/index';

export type PublishCatalogChangeFunction = (
  transaction: IStateTransaction,
  supplierOrganizationId: string,
  isShowcaseAffected: boolean,
) => void;

export const createCatalogChangePublisher = (outbox: IEventOutbox): PublishCatalogChangeFunction =>
  (transaction, supplierOrganizationId, isShowcaseAffected) => {
    const createPayload = (): Event['payload'] => ({
      case: 'listingsChanged',
      value: create(ListingsChangedSchema, { supplierOrganizationId }),
    });

    outbox.add(transaction, organizationChannel(supplierOrganizationId), createPayload());

    const supplier = transaction.get('organizations', supplierOrganizationId);
    const isMarketVisible = isShowcaseAffected && supplier !== undefined && isProfileVerified(supplier, ProfileKind.SUPPLIER);

    if (isMarketVisible) {
      outbox.add(transaction, marketChannel(), createPayload());
    }
  };
