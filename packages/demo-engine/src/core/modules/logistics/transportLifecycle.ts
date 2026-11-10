import type { TransportRequestRecord } from '@skladburg/contracts/logistics/v1/logistics_records';

import { create } from '@bufbuild/protobuf';
import { TransportRequestChangedSchema } from '@skladburg/contracts/logistics/v1/logistics_events';
import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';
import { organizationChannel } from '@skladburg/contracts/runtime';

import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import { canCarryTransportRequest } from './transportMatching';

export const publishTransportChanges = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  organizationIds: Iterable<string>,
): void => {
  for (const organizationId of new Set(organizationIds)) {
    runtime.outbox.add(transaction, organizationChannel(organizationId), {
      case: 'transportRequestChanged',
      value: create(TransportRequestChangedSchema),
    });
  }
};

export const transportRequestAudience = (
  runtime: IModuleRuntime,
  transaction: IStateTransaction,
  request: TransportRequestRecord,
): string[] => {
  const organizations = [request.customerOrganizationId, request.supplierOrganizationId];
  const offers = transaction.listBy('transportOffers', 'transportRequestId', request.id);

  if (request.status === TransportRequestStatus.OPEN) {
    const now = runtime.getWorldTimeMs();
    for (const organization of transaction.list('organizations')) {
      if (canCarryTransportRequest(transaction, request, organization.id, now)) {
        organizations.push(organization.id);
      }
    }
    organizations.push(...offers.map(offer => offer.carrierOrganizationId));
  }
  else {
    const selected = offers.find(offer => offer.id === request.selectedOfferId);
    if (selected !== undefined) {
      organizations.push(selected.carrierOrganizationId);
    }
  }

  return organizations;
};

export const cancelTransportRequest = (runtime: IModuleRuntime, transaction: IStateTransaction, dealId: string): void => {
  const request = transaction.listBy('transportRequests', 'dealId', dealId).find(
    current => current.status === TransportRequestStatus.OPEN || current.status === TransportRequestStatus.SELECTED,
  );
  if (request === undefined) {
    return;
  }

  const audience = transportRequestAudience(runtime, transaction, request);
  transaction.put('transportRequests', { ...request, status: TransportRequestStatus.CANCELLED, version: request.version + 1 });
  publishTransportChanges(runtime, transaction, audience);
};
