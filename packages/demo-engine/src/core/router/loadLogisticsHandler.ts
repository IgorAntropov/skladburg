import type { Interceptor } from '@connectrpc/connect';

import type { IModuleRuntime } from '../modules/index';
import type { EngineRequestHandler } from './engineRouter';

export const loadLogisticsHandler = (runtime: IModuleRuntime, supportAudit: Interceptor): EngineRequestHandler => {
  let handler: EngineRequestHandler | undefined;

  return async (request) => {
    if (handler === undefined) {
      const { createLogisticsHandler } = await import('../modules/logistics/index');
      handler = createLogisticsHandler(runtime, supportAudit);
    }

    return handler(request);
  };
};
