import type { IncomingMessage } from 'node:http';

import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';

export interface PreviewHeadersValue {
  cacheControl: string | undefined;
  status: number;
}

const readHeader = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export const requestPreviewHeaders = (address: string, isInsecureTlsAllowed: boolean): Promise<PreviewHeadersValue> => (
  new Promise((resolvePromise, rejectPromise) => {
    const handleResponse = (response: IncomingMessage): void => {
      response.resume();
      resolvePromise({ cacheControl: readHeader(response.headers['cache-control']), status: response.statusCode ?? 0 });
    };
    const request = address.startsWith('https:')
      ? httpsGet(address, { rejectUnauthorized: !isInsecureTlsAllowed }, handleResponse)
      : httpGet(address, handleResponse);

    request.on('error', rejectPromise);
  })
);
