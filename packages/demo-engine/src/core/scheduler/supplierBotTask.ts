import { DealStatus } from '@skladburg/contracts/deal/v1/deal';

import type { IModuleRuntime } from '../modules/index';
import type { SchedulerCommandTaskValue } from './scheduler';

export const createDeferredSupplierBotTask = (runtime: IModuleRuntime): SchedulerCommandTaskValue => ({
  id: 'supplier-bots',
  intervalMs: 60_000,
  runCommands: async (): Promise<void> => {
    const { read } = runtime;
    const hasPendingDeals = read.list('salesTerms').some(terms => terms.isAutoConfirmEnabled
      && read.listBy('deals', 'supplierOrganizationId', terms.organizationId).some(deal =>
        deal.status === DealStatus.SUBMITTED || deal.status === DealStatus.LOGISTICS_CHOSEN || deal.status === DealStatus.PAID));

    if (hasPendingDeals) {
      const { runSupplierBots } = await import('../modules/supplier-bots/index');
      await runSupplierBots(runtime);
    }
  },
});
