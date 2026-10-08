import type { ConnectRouter } from '@connectrpc/connect';

import { createRouterTransport } from '@connectrpc/connect';

import type {
  ApiRuntimeValue,
  QueryNetworkModeValue,
} from '../../runtime/apiRuntimeTypes';
import type { IDemoControl } from '../../transport/demo';

import { createApiClient } from '../../client/createApiClient';
import { createActingContextStore } from '../../context/createActingContextStore';
import { createActingOrganizationInterceptor } from '../../transport/createActingOrganizationInterceptor';

export const TEST_ORGANIZATION_ID = 'f0000001-0000-4000-8000-000000000000';
export const TEST_USER_ID = 'f0000002-0000-4000-8000-000000000000';

export interface TestRuntimeOptionsValue {
  demoControl?: IDemoControl | undefined;
  networkMode?: QueryNetworkModeValue | undefined;
  routes?: ((router: ConnectRouter) => void) | undefined;
}

const registerNoRoutes = (): void => undefined;

export const createTestRuntime = (options: TestRuntimeOptionsValue = {}): ApiRuntimeValue => {
  const actingContext = createActingContextStore({ organizationId: TEST_ORGANIZATION_ID, userId: TEST_USER_ID });
  const transport = createRouterTransport(options.routes ?? registerNoRoutes, {
    transport: { interceptors: [createActingOrganizationInterceptor(actingContext)] },
  });

  return {
    actingContext,
    client: createApiClient(transport),
    close: () => undefined,
    demoControl: options.demoControl,
    networkMode: options.networkMode ?? 'always',
    realtime: {
      stop: () => undefined,
      subscribe: () => () => undefined,
    },
  };
};
