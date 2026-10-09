import type { Client } from '@connectrpc/connect';
import type { AccessService } from '@skladburg/contracts/access/v1/access';
import type { ClockService } from '@skladburg/contracts/clock/v1/clock';
import type { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

export interface ApiClient {
  access: Client<typeof AccessService>;
  clock: Client<typeof ClockService>;
  organization: Client<typeof OrganizationService>;
}
