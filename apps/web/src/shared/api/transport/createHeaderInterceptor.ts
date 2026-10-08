import type { Interceptor } from '@connectrpc/connect';

export const createHeaderInterceptor = (headerName: string, readValue: () => string | undefined): Interceptor => next => (request) => {
  const value = readValue();

  if (value !== undefined && value !== '') {
    request.header.set(headerName, value);
  }

  return next(request);
};
