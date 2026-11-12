import type { IModuleRuntime } from '../moduleRuntime';

import { createDealDraftHandlers } from './dealDraftHandlers';
import { createDealNegotiationHandlers } from './dealNegotiationHandlers';

export const createDealNegotiation = async (
  runtime: IModuleRuntime,
): Promise<ReturnType<typeof createDealDraftHandlers> & ReturnType<typeof createDealNegotiationHandlers>> => {
  const modules = runtime.wmsOutboundWarehouseIds === undefined
    ? undefined
    : await Promise.all([
        import('../wms/outboundAvailability'),
        import('../wms/outboundReservation'),
      ]);
  const availabilityFor = modules === undefined
    ? undefined
    : modules[0].createOutboundAvailability.bind(undefined, runtime);
  return {
    ...createDealDraftHandlers(runtime, availabilityFor),
    ...createDealNegotiationHandlers(runtime, availabilityFor, modules?.[1].reserveOutboundStock),
  };
};
