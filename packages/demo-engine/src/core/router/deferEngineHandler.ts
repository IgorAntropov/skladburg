import type { EngineRequestHandler } from './engineRouter';

export const deferEngineHandler = (load: () => Promise<EngineRequestHandler>): EngineRequestHandler => {
  let handler: EngineRequestHandler | undefined;

  return async (request) => {
    handler ??= await load();

    return handler(request);
  };
};
