import type { Transport } from '@connectrpc/connect';

import { createClient } from '@connectrpc/connect';
import { AccessService } from '@skladburg/contracts/access/v1/access';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { NetworkService } from '@skladburg/contracts/network/v1/network';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

import type { ApiClient } from './apiClientTypes';

export const createApiClient = (transport: Transport): ApiClient => ({
  access: createClient(AccessService, transport),
  clock: createClient(ClockService, transport),
  network: createClient(NetworkService, transport),
  organization: createClient(OrganizationService, transport),
});
