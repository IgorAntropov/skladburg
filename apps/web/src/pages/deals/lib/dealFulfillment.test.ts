import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { getDealFulfillmentAction } from './dealFulfillment';

describe('getDealFulfillmentAction', () => {
  it('offers shipment to the supplier for supported deliveries after payment', () => {
    expect(getDealFulfillmentAction(DealStatus.PAID, DeliveryMethod.CUSTOMER, 'supplier')).toBe('markDealShipped');
    expect(getDealFulfillmentAction(DealStatus.PICKING, DeliveryMethod.SUPPLIER, 'supplier')).toBe('markDealShipped');
    expect(getDealFulfillmentAction(DealStatus.PAID, DeliveryMethod.EXCHANGE, 'supplier')).toBe('markDealShipped');
    expect(getDealFulfillmentAction(DealStatus.PICKING, DeliveryMethod.EXCHANGE, 'supplier')).toBe('markDealShipped');
    expect(getDealFulfillmentAction(DealStatus.PAID, DeliveryMethod.UNSPECIFIED, 'supplier')).toBeUndefined();
    expect(getDealFulfillmentAction(DealStatus.PAID, DeliveryMethod.CUSTOMER, 'customer')).toBeUndefined();
  });

  it('offers acceptance only to the customer after arrival', () => {
    expect(getDealFulfillmentAction(DealStatus.ARRIVED, DeliveryMethod.SUPPLIER, 'customer')).toBe('acceptDeal');
    expect(getDealFulfillmentAction(DealStatus.ACCEPTING, DeliveryMethod.CUSTOMER, 'customer')).toBe('acceptDeal');
    expect(getDealFulfillmentAction(DealStatus.ARRIVED, DeliveryMethod.CUSTOMER, 'supplier')).toBeUndefined();
    expect(getDealFulfillmentAction(DealStatus.IN_TRANSIT, DeliveryMethod.SUPPLIER, 'customer')).toBeUndefined();
  });
});
