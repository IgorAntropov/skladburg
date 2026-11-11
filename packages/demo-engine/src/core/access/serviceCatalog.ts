import type { DescService } from '@bufbuild/protobuf';

import { AccessService } from '@skladburg/contracts/access/v1/access';
import { UserProfileService } from '@skladburg/contracts/access/v1/profile';
import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import { ShowcaseService } from '@skladburg/contracts/catalog/v1/showcase';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { DocumentService } from '@skladburg/contracts/document/v1/document';
import { FleetService } from '@skladburg/contracts/fleet/v1/fleet';
import { ImportService } from '@skladburg/contracts/import/v1/import';
import { LogisticsService } from '@skladburg/contracts/logistics/v1/logistics';
import { NetworkService } from '@skladburg/contracts/network/v1/network';
import { NotificationService } from '@skladburg/contracts/notification/v1/notification';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import { OrganizationRequisitesService } from '@skladburg/contracts/organization/v1/requisites';
import { OrganizationShowcaseService } from '@skladburg/contracts/organization/v1/showcase';
import { PaymentService } from '@skladburg/contracts/payment/v1/payment';
import { SupportAccessService } from '@skladburg/contracts/support/v1/support_access';
import { SupportTicketService } from '@skladburg/contracts/support/v1/support_ticket';
import { WarehouseStockService } from '@skladburg/contracts/wms/v1/stock';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';

export const ENGINE_SERVICES: readonly DescService[] = [
  AccessService,
  CatalogService,
  ShowcaseService,
  ClockService,
  DealService,
  DocumentService,
  FleetService,
  ImportService,
  LogisticsService,
  NetworkService,
  NotificationService,
  OrganizationRequisitesService,
  OrganizationService,
  OrganizationShowcaseService,
  PaymentService,
  SupportAccessService,
  SupportTicketService,
  UserProfileService,
  WarehouseStockService,
  WarehouseTopologyService,
];
