import type { OrganizationDirectoryFilterValue } from '../../model/organizationDirectoryFilter';

interface OrganizationShowcaseKeysValue {
  all: readonly ['organization-showcase'];
  detail: (organizationScope: string, organizationId: string) => readonly ['organization-showcase', 'detail', string, string];
  list: (
    organizationScope: string,
    filter: OrganizationDirectoryFilterValue,
  ) => readonly ['organization-showcase', 'list', string, OrganizationDirectoryFilterValue];
}

export const organizationShowcaseKeys: OrganizationShowcaseKeysValue = {
  all: ['organization-showcase'],
  detail: (organizationScope, organizationId) => ['organization-showcase', 'detail', organizationScope, organizationId],
  list: (organizationScope, filter) => ['organization-showcase', 'list', organizationScope, filter],
};
