import type { ServiceImpl } from '@connectrpc/connect';
import type { PaymentService } from '@skladburg/contracts/payment/v1/payment';

import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';

import type { SchedulerTaskValue } from '../../scheduler/scheduler';
import type { IStateReader } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

let payments: typeof import('./index') | undefined;
let shipment: typeof import('../logistics/tripShipment') | undefined;

export const loadPayments = async (): Promise<typeof import('./index')> =>
  payments ??= await import('./index');

export const loadShipmentPayments = async (reader: IStateReader, dealId: string): Promise<typeof import('./index')> => {
  if (reader.get('deals', dealId)?.deliveryMethod === DeliveryMethod.EXCHANGE) {
    shipment ??= await import('../logistics/tripShipment');
  }
  return loadPayments();
};

export const getTripShipment = (): typeof shipment => shipment;

export const createDeferredPaymentTask = (runtime: IModuleRuntime): SchedulerTaskValue => ({
  id: 'safe-deal-payments',
  intervalMs: 60_000,
  run: (transaction) => {
    payments?.runPaymentTask(runtime, transaction);
  },
});

export const createDeferredPaymentService = (runtime: IModuleRuntime): ServiceImpl<typeof PaymentService> => {
  const loadService = (): Promise<ServiceImpl<typeof PaymentService>> =>
    loadPayments().then(module => module.createPaymentService(runtime));

  return {
    fundDeal: async (request, context) => (await loadService()).fundDeal(request, context),
    getDealPayment: async (request, context) => (await loadService()).getDealPayment(request, context),
  };
};
