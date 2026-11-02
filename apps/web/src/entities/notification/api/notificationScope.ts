import { userChannel } from '@skladburg/contracts/runtime';

import type {
  ApiQueryMetaValue,
  RealtimeEventCaseValue,
} from '@/shared/api';

const NOTIFICATION_EVENT_CASES: readonly RealtimeEventCaseValue[] = ['notificationsChanged'];

export const createNotificationQueryMeta = (userId: string | undefined): ApiQueryMetaValue => ({
  channels: userId === undefined ? [] : [userChannel(userId)],
  eventCases: NOTIFICATION_EVENT_CASES,
});
