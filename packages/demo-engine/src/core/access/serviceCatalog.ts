import type { DescService } from '@bufbuild/protobuf';

import { AccessService } from '@skladburg/contracts/access/v1/access';
import { UserProfileService } from '@skladburg/contracts/access/v1/profile';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { NetworkService } from '@skladburg/contracts/network/v1/network';
import { NotificationService } from '@skladburg/contracts/notification/v1/notification';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import { OrganizationShowcaseService } from '@skladburg/contracts/organization/v1/showcase';

export const ENGINE_SERVICES: readonly DescService[] = [
  AccessService,
  ClockService,
  NetworkService,
  NotificationService,
  OrganizationService,
  OrganizationShowcaseService,
  UserProfileService,
];
