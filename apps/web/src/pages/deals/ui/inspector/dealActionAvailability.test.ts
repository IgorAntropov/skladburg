import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { getDealActions } from './dealActionAvailability';

describe('getDealActions', () => {
  it('offers publication on an agreed deal to either party with transport permission', () => {
    expect(getDealActions(DealStatus.AGREED, 'supplier', DeliveryMethod.UNSPECIFIED, true)).toEqual(['publishTransport', 'cancel']);
    expect(getDealActions(DealStatus.AGREED, 'customer', DeliveryMethod.UNSPECIFIED, true)).toEqual([
      'delivery', 'publishTransport', 'cancel',
    ]);
    expect(getDealActions(DealStatus.AGREED, 'supplier', DeliveryMethod.UNSPECIFIED, false)).toEqual(['cancel']);
  });

  it('does not offer direct delivery changes once a request has been published', () => {
    expect(getDealActions(DealStatus.AWAITING_LOGISTICS, 'customer', DeliveryMethod.EXCHANGE, true)).toEqual(['cancel']);
    expect(getDealActions(DealStatus.AWAITING_LOGISTICS, 'customer', DeliveryMethod.UNSPECIFIED, true)).toEqual(['delivery', 'cancel']);
  });

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
