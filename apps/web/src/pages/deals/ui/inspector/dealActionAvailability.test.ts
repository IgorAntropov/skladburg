import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { getDealActions } from './dealActionAvailability';

describe('getDealActions', () => {
  it('keeps actions for the actor whose turn it is and cancellation for both parties', () => {
    expect(getDealActions(DealStatus.SUBMITTED, 'supplier')).toEqual(['confirm', 'counter', 'reject', 'cancel']);
    expect(getDealActions(DealStatus.SUBMITTED, 'customer')).toEqual(['cancel']);
    expect(getDealActions(DealStatus.COUNTER_OFFERED, 'customer')).toEqual(['accept', 'rejectOffer', 'cancel']);
  });

  it('lets the customer cancel after funding until shipment', () => {
    expect(getDealActions(DealStatus.AWAITING_PAYMENT, 'customer')).toEqual(['cancel']);
    expect(getDealActions(DealStatus.PAID, 'customer')).toEqual(['cancel']);
    expect(getDealActions(DealStatus.PICKING, 'customer')).toEqual(['cancel']);
    expect(getDealActions(DealStatus.PAID, 'supplier')).toEqual([]);
    expect(getDealActions(DealStatus.SHIPPED, 'customer')).toEqual([]);
  });

  it('prevents actions from a third party or on a hidden supplier draft', () => {
    expect(getDealActions(DealStatus.SUBMITTED, undefined)).toEqual([]);
    expect(getDealActions(DealStatus.DRAFT, 'supplier')).toEqual([]);
  });
});
