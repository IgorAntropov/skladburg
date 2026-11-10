import type { TransportRequestRecord } from '@skladburg/contracts/logistics/v1/logistics_records';

import { TransportRequestStatus } from '@skladburg/contracts/logistics/v1/logistics_records';

import type { IStateTransaction } from '../../state/index';

import { canCarryTransportRequest } from './transportMatching';

export const transportRequestAudience = (
  transaction: IStateTransaction,
  request: TransportRequestRecord,
): string[] => {
  const organizations = [request.customerOrganizationId, request.supplierOrganizationId];
  const offers = transaction.listBy('transportOffers', 'transportRequestId', request.id);

  if (request.status === TransportRequestStatus.OPEN) {
    const now = transaction.worldTimeMs;
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
