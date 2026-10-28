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
import { UserProfileService } from '@skladburg/contracts/access/v1/profile';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { NetworkService } from '@skladburg/contracts/network/v1/network';
import { NotificationService } from '@skladburg/contracts/notification/v1/notification';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import { OrganizationShowcaseService } from '@skladburg/contracts/organization/v1/showcase';
import { SupportAccessService } from '@skladburg/contracts/support/v1/support_access';
import { SupportTicketService } from '@skladburg/contracts/support/v1/support_ticket';

import type { IDomainErrors } from '../errors/index';

export interface CreateEngineHandlerOptionsValue {
  accessService: ServiceImpl<typeof AccessService>;
  clockService: ServiceImpl<typeof ClockService>;
  errors: IDomainErrors;
  networkService: ServiceImpl<typeof NetworkService>;
  notificationService: ServiceImpl<typeof NotificationService>;
  organizationService: ServiceImpl<typeof OrganizationService>;
  organizationShowcaseService: ServiceImpl<typeof OrganizationShowcaseService>;
  supportAccessService: ServiceImpl<typeof SupportAccessService>;
  supportAudit: Interceptor;
  supportTicketService: ServiceImpl<typeof SupportTicketService>;
  userProfileService: ServiceImpl<typeof UserProfileService>;
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
    interceptors: [createErrorNormalizer(options.errors), options.supportAudit],
  });

  router.service(AccessService, options.accessService);
  router.service(ClockService, options.clockService);
  router.service(NetworkService, options.networkService);
  router.service(NotificationService, options.notificationService);
  router.service(OrganizationService, options.organizationService);
  router.service(OrganizationShowcaseService, options.organizationShowcaseService);
  router.service(SupportAccessService, options.supportAccessService);
  router.service(SupportTicketService, options.supportTicketService);
  router.service(UserProfileService, options.userProfileService);

  return createFetchHandler(createPathDispatcher(router.handlers));
};
