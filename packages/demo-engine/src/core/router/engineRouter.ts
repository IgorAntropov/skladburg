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
import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import { ShowcaseService } from '@skladburg/contracts/catalog/v1/showcase';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { DocumentService } from '@skladburg/contracts/document/v1/document';
import { ImportService } from '@skladburg/contracts/import/v1/import';
import { NetworkService } from '@skladburg/contracts/network/v1/network';
import { NotificationService } from '@skladburg/contracts/notification/v1/notification';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import { OrganizationRequisitesService } from '@skladburg/contracts/organization/v1/requisites';
import { OrganizationShowcaseService } from '@skladburg/contracts/organization/v1/showcase';
import { PaymentService } from '@skladburg/contracts/payment/v1/payment';
import { SupportAccessService } from '@skladburg/contracts/support/v1/support_access';
import { SupportTicketService } from '@skladburg/contracts/support/v1/support_ticket';

import type { IDomainErrors } from '../errors/index';

export interface CreateEngineHandlerOptionsValue {
  accessService: ServiceImpl<typeof AccessService>;
  catalogService: ServiceImpl<typeof CatalogService>;
  catalogShowcaseService: ServiceImpl<typeof ShowcaseService>;
  clockService: ServiceImpl<typeof ClockService>;
  dealService: ServiceImpl<typeof DealService>;
  documentService: ServiceImpl<typeof DocumentService>;
  errors: IDomainErrors;
  importService: ServiceImpl<typeof ImportService>;
  networkService: ServiceImpl<typeof NetworkService>;
  notificationService: ServiceImpl<typeof NotificationService>;
  organizationRequisitesService: ServiceImpl<typeof OrganizationRequisitesService>;
  organizationService: ServiceImpl<typeof OrganizationService>;
  organizationShowcaseService: ServiceImpl<typeof OrganizationShowcaseService>;
  paymentService: ServiceImpl<typeof PaymentService>;
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
  router.service(CatalogService, options.catalogService);
  router.service(ShowcaseService, options.catalogShowcaseService);
  router.service(ClockService, options.clockService);
  router.service(DealService, options.dealService);
  router.service(DocumentService, options.documentService);
  router.service(ImportService, options.importService, { readMaxBytes: 6 * 1024 * 1024, writeMaxBytes: 4 * 1024 * 1024 });
  router.service(NetworkService, options.networkService);
  router.service(NotificationService, options.notificationService);
  router.service(OrganizationService, options.organizationService);
  router.service(OrganizationRequisitesService, options.organizationRequisitesService);
  router.service(OrganizationShowcaseService, options.organizationShowcaseService);
  router.service(PaymentService, options.paymentService);
  router.service(SupportAccessService, options.supportAccessService);
  router.service(SupportTicketService, options.supportTicketService);
  router.service(UserProfileService, options.userProfileService);

  return createFetchHandler(createPathDispatcher(router.handlers));
};
