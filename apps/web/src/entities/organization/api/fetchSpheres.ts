import type { Sphere } from '@skladburg/contracts/organization/v1/organization';

import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

import type { ApiClient } from '@/shared/api';

import { collectPages } from '@/shared/api';

export const fetchSpheres = (client: ApiClient): Promise<Sphere[]> => collectPages(async (page) => {
  const response = await client.service(OrganizationService).listSpheres({ page });

  return { items: response.spheres, nextPageToken: response.page?.nextPageToken ?? '' };
});
