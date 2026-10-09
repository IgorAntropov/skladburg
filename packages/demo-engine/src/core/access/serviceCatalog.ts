import type { DescService } from '@bufbuild/protobuf';

import { AccessService } from '@skladburg/contracts/access/v1/access';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

export const ENGINE_SERVICES: readonly DescService[] = [AccessService, ClockService, OrganizationService];
