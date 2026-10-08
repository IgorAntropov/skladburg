import type {
  ApiRuntimeValue,
  CreateApiRuntimeOptionsValue,
} from './apiRuntimeTypes';

import { createApiClient } from '../client/createApiClient';
import { createActingContextStore } from '../context/createActingContextStore';
import { createBrowserFrameScheduler } from '../realtime/createBrowserFrameScheduler';
import { createRealtimeChannel } from '../realtime/createRealtimeChannel';
import { selectInitialPersona } from './selectInitialPersona';

export const createDemoRuntime = async (options: CreateApiRuntimeOptionsValue): Promise<ApiRuntimeValue> => {
  const demo = await import('../transport/demo');
  const connection = options.connection ?? await demo.createEngineWorkerConnection();
  const actingContext = createActingContextStore({ organizationId: undefined, userId: undefined });
  const demoControl = demo.createDemoControl(connection);

  console.log('> createApiRuntime -> connect:', {
    defaultOrganizationId: options.defaultOrganizationId,
    mode: 'demo',
  });

  const personas = await demoControl.listPersonas().catch((error: unknown) => {
    console.log('> createApiRuntime -> listPersonas:', { error });
    connection.close();

    throw error;
  });
  const persona = selectInitialPersona(personas, {
    defaultOrganizationId: options.defaultOrganizationId,
    preferredContext: options.preferredContext,
    preferredPersonaId: options.preferredPersonaId,
  });

  if (persona === undefined) {
    console.log('> createApiRuntime -> selectInitialPersona:', { organizationId: options.defaultOrganizationId });
    connection.close();

    throw new Error(`The demo engine has no persona for organization "${options.defaultOrganizationId}"`);
  }

  actingContext.set({ organizationId: persona.organizationId, userId: persona.userId });

  const realtime = createRealtimeChannel({
    actingContext,
    frameScheduler: options.frameScheduler ?? createBrowserFrameScheduler(),
    source: demo.createDemoRealtimeSource(connection),
  });

  return {
    actingContext,
    client: createApiClient(demo.createDemoTransport({ actingContext, connection })),
    close: () => {
      realtime.stop();
      connection.close();
    },
    demoControl,
    networkMode: 'always',
    realtime,
  };
};
