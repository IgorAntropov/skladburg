import type {
  ApiRuntimeValue,
  CreateApiRuntimeOptionsValue,
} from './apiRuntimeTypes';

import { createApiClient } from '../client/createApiClient';
import { createActingContextStore } from '../context/createActingContextStore';
import { createBrowserFrameScheduler } from '../realtime/createBrowserFrameScheduler';
import { createRealtimeChannel } from '../realtime/createRealtimeChannel';
import { createSilentRealtimeSource } from '../realtime/createSilentRealtimeSource';
import { createConnectApiTransport } from '../transport/connect/createConnectApiTransport';
import { createActingOrganizationInterceptor } from '../transport/createActingOrganizationInterceptor';

export const createPilotRuntime = (options: CreateApiRuntimeOptionsValue): ApiRuntimeValue => {
  console.log('> createApiRuntime -> connect:', {
    defaultOrganizationId: options.defaultOrganizationId,
    mode: 'connect',
  });

  const actingContext = createActingContextStore({ organizationId: options.defaultOrganizationId, userId: undefined });
  const transport = createConnectApiTransport({
    apiUrl: import.meta.env.VITE_API_URL,
    interceptors: [createActingOrganizationInterceptor(actingContext)],
  });

  const realtime = createRealtimeChannel({
    actingContext,
    frameScheduler: options.frameScheduler ?? createBrowserFrameScheduler(),
    source: createSilentRealtimeSource(),
  });

  return {
    actingContext,
    client: createApiClient(transport),
    close: () => {
      realtime.stop();
    },
    demoControl: undefined,
    realtime,
  };
};
