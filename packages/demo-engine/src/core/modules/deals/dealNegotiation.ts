import type { IModuleRuntime } from '../moduleRuntime';

import { createDealDraftHandlers } from './dealDraftHandlers';
import { createDealNegotiationHandlers } from './dealNegotiationHandlers';

export const createDealNegotiation = (
  runtime: IModuleRuntime,
): ReturnType<typeof createDealDraftHandlers> & ReturnType<typeof createDealNegotiationHandlers> => ({
  ...createDealDraftHandlers(runtime),
  ...createDealNegotiationHandlers(runtime),
});
