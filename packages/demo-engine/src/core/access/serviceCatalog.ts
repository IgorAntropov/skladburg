import type { DescService } from '@bufbuild/protobuf';

import { AccessService } from '@skladburg/contracts/access/v1/access';
import { UserProfileService } from '@skladburg/contracts/access/v1/profile';
import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { NetworkService } from '@skladburg/contracts/network/v1/network';
import { NotificationService } from '@skladburg/contracts/notification/v1/notification';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import { OrganizationRequisitesService } from '@skladburg/contracts/organization/v1/requisites';
import { OrganizationShowcaseService } from '@skladburg/contracts/organization/v1/showcase';
import { SupportAccessService } from '@skladburg/contracts/support/v1/support_access';
import { SupportTicketService } from '@skladburg/contracts/support/v1/support_ticket';

export const ENGINE_SERVICES: readonly DescService[] = [
  AccessService,
  CatalogService,
  ClockService,
  NetworkService,
  NotificationService,
  OrganizationRequisitesService,
  OrganizationService,
  OrganizationShowcaseService,
  SupportAccessService,
  SupportTicketService,
  UserProfileService,
];
