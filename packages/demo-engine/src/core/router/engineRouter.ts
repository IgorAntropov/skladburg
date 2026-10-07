import type {
  Interceptor,
  ServiceImpl,
} from '@connectrpc/connect';
import type {
  UniversalHandler,
  UniversalHandlerFn,
} from '@connectrpc/connect/protocol';

import { createConnectRouter } from '@connectrpc/connect';
import {
  createFetchHandler,
  uResponseNotFound,
} from '@connectrpc/connect/protocol';
import { AccessService } from '@skladburg/contracts/access/v1/access';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

import type { IDomainErrors } from '../errors/index';

export interface CreateEngineHandlerOptionsValue {
  accessService: ServiceImpl<typeof AccessService>;
  errors: IDomainErrors;
  organizationService: ServiceImpl<typeof OrganizationService>;
}

export type EngineRequestHandler = (request: Request) => Promise<Response>;

const createErrorNormalizer = (errors: IDomainErrors): Interceptor => next => async (request) => {
  try {
    return await next(request);
  }
  catch (error) {
    throw errors.from(error);
  }
};

const createPathDispatcher = (handlers: readonly UniversalHandler[]): UniversalHandlerFn => {
  const handlersByPath = new Map(handlers.map(handler => [handler.requestPath, handler]));

  return (request) => {
    const handler = handlersByPath.get(new URL(request.url).pathname);

    return handler === undefined ? Promise.resolve(uResponseNotFound) : handler(request);
  };
};

export const createEngineHandler = (options: CreateEngineHandlerOptionsValue): EngineRequestHandler => {
  const router = createConnectRouter({
    connect: true,
    grpc: false,
    grpcWeb: false,
    interceptors: [createErrorNormalizer(options.errors)],
  });

  router.service(AccessService, options.accessService);
  router.service(OrganizationService, options.organizationService);

  return createFetchHandler(createPathDispatcher(router.handlers));
};
