import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

import type { ApiClient } from '@/shared/api';

import { collectPages } from '@/shared/api';

export const fetchSearchWarehouses = (client: ApiClient): Promise<Warehouse[]> => collectPages(async (page) => {
  const response = await client.service(OrganizationService).listWarehouses({ page });

  return { items: response.warehouses, nextPageToken: response.page?.nextPageToken ?? '' };
});
