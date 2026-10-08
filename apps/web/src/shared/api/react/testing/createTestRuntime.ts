import { createRouterTransport } from '@connectrpc/connect';

import type { ApiRuntimeValue } from '../../runtime/apiRuntimeTypes';
import type { IDemoControl } from '../../transport/demo';

import { createApiClient } from '../../client/createApiClient';
import { createActingContextStore } from '../../context/createActingContextStore';

export interface TestRuntimeOptionsValue {
  demoControl?: IDemoControl | undefined;
}

export const createTestRuntime = (options: TestRuntimeOptionsValue = {}): ApiRuntimeValue => ({
  actingContext: createActingContextStore({ organizationId: 'org-1', userId: 'user-1' }),
  client: createApiClient(createRouterTransport(() => undefined)),
  close: () => undefined,
  demoControl: options.demoControl,
  realtime: {
    stop: () => undefined,
    subscribe: () => () => undefined,
  },
});
