import type { Transport } from '@connectrpc/connect';
import type { IEngineConnection } from '@skladburg/demo-engine/client';

import { createConnectTransport } from '@connectrpc/connect-web';
import {
  DEMO_USER_HEADER,
  ENGINE_BASE_URL,
} from '@skladburg/demo-engine/client';

import type { IActingContextStore } from '../../context/actingContextTypes';

import { createActingOrganizationInterceptor } from '../createActingOrganizationInterceptor';
import { createHeaderInterceptor } from '../createHeaderInterceptor';

export interface DemoTransportOptionsValue {
  actingContext: IActingContextStore;
  connection: IEngineConnection;
}

export const createDemoTransport = (options: DemoTransportOptionsValue): Transport => {
  const { actingContext, connection } = options;

  return createConnectTransport({
    baseUrl: ENGINE_BASE_URL,
    fetch: connection.fetch,
    interceptors: [
      createActingOrganizationInterceptor(actingContext),
      createHeaderInterceptor(DEMO_USER_HEADER, () => actingContext.get().userId),
    ],
    useBinaryFormat: true,
  });
};
