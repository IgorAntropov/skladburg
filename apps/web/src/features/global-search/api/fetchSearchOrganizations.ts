import type { OrganizationShowcase } from '@skladburg/contracts/organization/v1/showcase';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import { OrganizationShowcaseService } from '@skladburg/contracts/organization/v1/showcase';

import type { ApiClient } from '@/shared/api';

import { collectPages } from '@/shared/api';

export const fetchSearchOrganizations = (client: ApiClient): Promise<OrganizationShowcase[]> => collectPages(async (page) => {
  const response = await client.service(OrganizationShowcaseService).listOrganizationShowcases({
    minVerificationLevel: 0,
    page,
    profileKind: ProfileKind.UNSPECIFIED,
    sphereId: '',
  });

  return { items: response.organizations, nextPageToken: response.page?.nextPageToken ?? '' };
});
