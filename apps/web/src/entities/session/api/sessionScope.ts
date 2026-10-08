import {
  organizationChannel,
  userChannel,
} from '@skladburg/contracts/runtime';

import type { ApiQueryMetaValue } from '@/shared/api';

export const NO_SESSION_SCOPE = 'none';

export const getSessionScope = (id: string | undefined): string => id ?? NO_SESSION_SCOPE;

export const createSessionQueryMeta = (
  organizationId: string | undefined,
  userId: string | undefined,
): ApiQueryMetaValue => ({
  channels: [
    ...organizationId === undefined ? [] : [organizationChannel(organizationId)],
    ...userId === undefined ? [] : [userChannel(userId)],
  ],
});
