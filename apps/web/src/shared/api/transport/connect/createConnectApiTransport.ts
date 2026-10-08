import type {
  Interceptor,
  Transport,
} from '@connectrpc/connect';

import { createConnectTransport } from '@connectrpc/connect-web';

export interface ConnectApiTransportOptionsValue {
  apiUrl: string | undefined;
  interceptors: readonly Interceptor[];
}

export const createConnectApiTransport = (options: ConnectApiTransportOptionsValue): Transport => {
  const { apiUrl, interceptors } = options;

  if (apiUrl === undefined || apiUrl === '') {
    console.log('> createConnectApiTransport -> create:', { reason: 'VITE_API_URL is not set' });
    throw new Error('The API address is not configured: set VITE_API_URL for the connect transport');
  }

  return createConnectTransport({
    baseUrl: apiUrl,
    interceptors: [...interceptors],
    useBinaryFormat: true,
  });
};
