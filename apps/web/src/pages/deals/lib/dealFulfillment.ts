import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';

export type DealFulfillmentActionValue = 'acceptDeal' | 'markDealShipped';

export const isSupportedDealDelivery = (method: DeliveryMethod): boolean =>
  method === DeliveryMethod.CUSTOMER || method === DeliveryMethod.SUPPLIER || method === DeliveryMethod.EXCHANGE;

export const getDealFulfillmentAction = (
  status: DealStatus,
  method: DeliveryMethod,
  party: 'customer' | 'supplier' | undefined,
): DealFulfillmentActionValue | undefined => {
  if (party === 'supplier' && (status === DealStatus.PAID || status === DealStatus.PICKING) && isSupportedDealDelivery(method)) {
    return 'markDealShipped';
  }
  if (party === 'customer' && (status === DealStatus.ARRIVED || status === DealStatus.ACCEPTING)) {
    return 'acceptDeal';
  }
  return undefined;
};
