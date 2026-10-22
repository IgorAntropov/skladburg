import type { OrganizationShowcase } from '@skladburg/contracts/organization/v1/showcase';

import { OrganizationShowcaseService } from '@skladburg/contracts/organization/v1/showcase';

import type { ApiClient } from '@/shared/api';

import { collectPages } from '@/shared/api';

import type { OrganizationDirectoryFilterValue } from '../../model/organizationDirectoryFilter';

export const fetchOrganizationShowcases = (
  client: ApiClient,
  filter: OrganizationDirectoryFilterValue,
): Promise<OrganizationShowcase[]> => collectPages(async (page) => {
  const response = await client.service(OrganizationShowcaseService).listOrganizationShowcases({
    minVerificationLevel: filter.minVerificationLevel,
    page,
    profileKind: filter.profileKind,
    sphereId: filter.sphereId,
  });

  return { items: response.organizations, nextPageToken: response.page?.nextPageToken ?? '' };
});
