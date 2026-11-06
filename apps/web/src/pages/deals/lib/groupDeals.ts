import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { DealStatus } from '@skladburg/contracts/deal/v1/deal';

interface DealGroupsValue {
  active: Deal[];
  closed: Deal[];
  mine: Deal[];
}

const CLOSED_STATUSES = new Set([DealStatus.CANCELLED, DealStatus.CLOSED, DealStatus.REJECTED]);
const CUSTOMER_TURN_STATUSES = new Set([DealStatus.AGREED, DealStatus.AWAITING_LOGISTICS, DealStatus.COUNTER_OFFERED, DealStatus.DRAFT]);

export const isOrganizationTurn = (deal: Deal, organizationId: string): boolean => (
  (deal.customerOrganizationId === organizationId && CUSTOMER_TURN_STATUSES.has(deal.status))
  || (deal.supplierOrganizationId === organizationId && deal.status === DealStatus.SUBMITTED)
);

export const groupDeals = (deals: readonly Deal[], organizationId: string): DealGroupsValue => {
  const groups: DealGroupsValue = { active: [], closed: [], mine: [] };

  for (const deal of deals) {
    if (CLOSED_STATUSES.has(deal.status)) {
      groups.closed.push(deal);
    }
    else if (isOrganizationTurn(deal, organizationId)) {
      groups.mine.push(deal);
    }
    else {
      groups.active.push(deal);
    }
  }

  return groups;
};
