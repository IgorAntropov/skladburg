import type { ServiceImpl } from '@connectrpc/connect';
import type { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

import type { IModuleRuntime } from './moduleRuntime';

import { createOrganizationReadHandlers } from './identity/index';
import { createWarehouseHandlers } from './wms/index';

export const createOrganizationService = (runtime: IModuleRuntime): ServiceImpl<typeof OrganizationService> => ({
  ...createOrganizationReadHandlers(runtime),
  ...createWarehouseHandlers(runtime),
});
