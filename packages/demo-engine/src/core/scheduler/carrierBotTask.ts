import type { IModuleRuntime } from '../modules/index';
import type { SchedulerCommandTaskValue } from './scheduler';

import {
  CARRIER_BOT_RESPONSE_DELAY_MS,
  isCarrierBotRequestDue,
} from '../modules/carrier-bots/requestDue';

export const createDeferredCarrierBotTask = (runtime: IModuleRuntime): SchedulerCommandTaskValue => ({
  id: 'carrier-bots',
  intervalMs: CARRIER_BOT_RESPONSE_DELAY_MS,
  runCommands: async (): Promise<void> => {
    const { getWorldTimeMs, read } = runtime;
    const nowMs = getWorldTimeMs();

    if (read.list('transportRequests').some(request => isCarrierBotRequestDue(request, nowMs))) {
      const { runCarrierBots } = await import('../modules/carrier-bots/index');
      await runCarrierBots(runtime);
    }
  },
});
