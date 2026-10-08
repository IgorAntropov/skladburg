import { organizationChannel } from '@skladburg/contracts/runtime';

import type { ApiQueryMetaValue } from '@/shared/api';

export const NO_ORGANIZATION_SCOPE = 'none';

export const getOrganizationScope = (organizationId: string | undefined): string => organizationId ?? NO_ORGANIZATION_SCOPE;

export const createOrganizationQueryMeta = (organizationId: string | undefined): ApiQueryMetaValue => ({
  channels: organizationId === undefined ? [] : [organizationChannel(organizationId)],
});
