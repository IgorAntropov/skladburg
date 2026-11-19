import type { IModuleRuntime } from '../modules/index';
import type { SchedulerTaskValue } from './scheduler';

import {
  createDealDeadlineTask,
  createSupportAccessExpiryTask,
  createSupportBotTask,
} from '../modules/index';
import { createDeferredPaymentTask } from '../modules/payments/loadPayments';
import { createDeferredCarrierBotTask } from './carrierBotTask';
import { createDeferredSupplierBotTask } from './supplierBotTask';

export const createEngineTasks = (runtime: IModuleRuntime): readonly SchedulerTaskValue[] => [
  createSupportBotTask(runtime),
  createSupportAccessExpiryTask(runtime),
  createDealDeadlineTask(runtime),
  createDeferredPaymentTask(runtime),
  createDeferredSupplierBotTask(runtime),
  createDeferredCarrierBotTask(runtime),
  ...(runtime.refreshInboundDockSchedules === undefined
    ? []
    : [{
        id: 'inbound-dock-schedules',
        intervalMs: 1_000,
        isCoalesced: true,
        runCommands: async (): Promise<void> => runtime.refreshInboundDockSchedules?.(runtime),
      }]),
];
