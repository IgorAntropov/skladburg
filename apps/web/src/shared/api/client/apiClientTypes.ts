import type { Client } from '@connectrpc/connect';
import type { AccessService } from '@skladburg/contracts/access/v1/access';
import type { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

export interface ApiClient {
  access: Client<typeof AccessService>;
  organization: Client<typeof OrganizationService>;
}
