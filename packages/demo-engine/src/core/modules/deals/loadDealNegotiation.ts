import type { ServiceImpl } from '@connectrpc/connect';
import type { DealService } from '@skladburg/contracts/deal/v1/deal';

import type { IModuleRuntime } from '../moduleRuntime';

type DealNegotiationValue = Pick<ServiceImpl<typeof DealService>,
  'acceptCounterOffer' | 'confirmDeal' | 'counterDeal' | 'createDealDraft' | 'submitDeal' | 'updateDealDraft'>;

export const loadDealNegotiation = (runtime: IModuleRuntime): DealNegotiationValue => {
  const loadHandlers = (): Promise<DealNegotiationValue> =>
    import('./dealNegotiation').then(module => module.createDealNegotiation(runtime));

  return {
    acceptCounterOffer: async (request, context) => (await loadHandlers()).acceptCounterOffer(request, context),
    confirmDeal: async (request, context) => (await loadHandlers()).confirmDeal(request, context),
    counterDeal: async (request, context) => (await loadHandlers()).counterDeal(request, context),
    createDealDraft: async (request, context) => (await loadHandlers()).createDealDraft(request, context),
    submitDeal: async (request, context) => (await loadHandlers()).submitDeal(request, context),
    updateDealDraft: async (request, context) => (await loadHandlers()).updateDealDraft(request, context),
  };
};
