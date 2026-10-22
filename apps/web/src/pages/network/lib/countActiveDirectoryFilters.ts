import type { OrganizationDirectoryFilterValue } from '../model/organizationDirectoryFilter';

import { DEFAULT_ORGANIZATION_DIRECTORY_FILTER } from '../model/organizationDirectoryFilter';

export const countActiveDirectoryFilters = (filter: OrganizationDirectoryFilterValue): number => [
  filter.profileKind !== DEFAULT_ORGANIZATION_DIRECTORY_FILTER.profileKind,
  filter.sphereId !== DEFAULT_ORGANIZATION_DIRECTORY_FILTER.sphereId,
  filter.minVerificationLevel !== DEFAULT_ORGANIZATION_DIRECTORY_FILTER.minVerificationLevel,
].filter(Boolean).length;
