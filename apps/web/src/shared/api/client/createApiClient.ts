import type { DescService } from '@bufbuild/protobuf';
import type {
  Client,
  Transport,
} from '@connectrpc/connect';

import { createClient } from '@connectrpc/connect';

import type { ApiClient } from './apiClientTypes';

export const createApiClient = (transport: Transport): ApiClient => {
  const clientsByService = new WeakMap<DescService, Client<DescService>>();

  return {
    service: <TService extends DescService>(service: TService): Client<TService> => {
      const cachedClient = clientsByService.get(service);

      if (cachedClient !== undefined) {
        return cachedClient as Client<TService>;
      }

      const createdClient = createClient(service, transport);

      clientsByService.set(service, createdClient);

      return createdClient;
    },
  };
};
