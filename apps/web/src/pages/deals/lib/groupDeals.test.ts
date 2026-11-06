import { create } from '@bufbuild/protobuf';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { groupDeals } from './groupDeals';

const CUSTOMER = 'customer';
const SUPPLIER = 'supplier';

describe('groupDeals', () => {
  it('groups by the current organization’s turn, independently of the employee’s permissions', () => {
    const deals = [
      DealStatus.DRAFT,
      DealStatus.SUBMITTED,
      DealStatus.COUNTER_OFFERED,
      DealStatus.AGREED,
      DealStatus.AWAITING_LOGISTICS,
      DealStatus.LOGISTICS_CHOSEN,
      DealStatus.REJECTED,
      DealStatus.CANCELLED,
      DealStatus.CLOSED,
    ].map(status => create(DealSchema, {
      customerOrganizationId: CUSTOMER,
      id: String(status),
      status,
      supplierOrganizationId: SUPPLIER,
    }));

    const getStatuses = (side: string): DealStatus[][] => {
      const grouped = groupDeals(deals, side);
      return [grouped.mine, grouped.active, grouped.closed].map(group => group.map(deal => deal.status));
    };

    expect(getStatuses(CUSTOMER)).toEqual([
      [DealStatus.DRAFT, DealStatus.COUNTER_OFFERED, DealStatus.AGREED, DealStatus.AWAITING_LOGISTICS],
      [DealStatus.SUBMITTED, DealStatus.LOGISTICS_CHOSEN],
      [DealStatus.REJECTED, DealStatus.CANCELLED, DealStatus.CLOSED],
    ]);
    expect(getStatuses(SUPPLIER)).toEqual([
      [DealStatus.SUBMITTED],
      [DealStatus.DRAFT, DealStatus.COUNTER_OFFERED, DealStatus.AGREED, DealStatus.AWAITING_LOGISTICS, DealStatus.LOGISTICS_CHOSEN],
      [DealStatus.REJECTED, DealStatus.CANCELLED, DealStatus.CLOSED],
    ]);
  });
});
