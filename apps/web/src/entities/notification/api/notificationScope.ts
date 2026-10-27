import { userChannel } from '@skladburg/contracts/runtime';

import type { ApiQueryMetaValue } from '@/shared/api';

export const createNotificationQueryMeta = (userId: string | undefined): ApiQueryMetaValue => ({
  channels: userId === undefined ? [] : [userChannel(userId)],
});
