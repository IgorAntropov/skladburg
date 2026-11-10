import type { Deal } from '@skladburg/contracts/deal/v1/deal';

import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';

import type { IDomainErrors } from '../../errors/index';

type ExchangePaymentsValue = typeof import('./exchangePayment');

let exchangePayments: ExchangePaymentsValue | undefined;

export const loadExchangePayments = async (): Promise<ExchangePaymentsValue> =>
  exchangePayments ??= await import('./exchangePayment');

export const getExchangePayments = (errors: IDomainErrors, deal: Deal): ExchangePaymentsValue | undefined => {
  if (deal.deliveryMethod !== DeliveryMethod.EXCHANGE) {
    return undefined;
  }

  if (exchangePayments === undefined) {
    throw errors.unavailable();
  }

  return exchangePayments;
};
