import type { Client } from '@connectrpc/connect';
import type { AccessService } from '@skladburg/contracts/access/v1/access';
import type { ClockService } from '@skladburg/contracts/clock/v1/clock';
import type { NetworkService } from '@skladburg/contracts/network/v1/network';
import type { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

export interface ApiClient {
  access: Client<typeof AccessService>;
  clock: Client<typeof ClockService>;
  network: Client<typeof NetworkService>;
  organization: Client<typeof OrganizationService>;
}
