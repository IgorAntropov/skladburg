import { userChannel } from '@skladburg/contracts/runtime';

import type {
  ApiQueryMetaValue,
  RealtimeEventCaseValue,
} from '@/shared/api';

const SUPPORT_TICKET_EVENT_CASES: readonly RealtimeEventCaseValue[] = ['supportTicketChanged'];

export const createSupportTicketQueryMeta = (userId: string | undefined): ApiQueryMetaValue => ({
  channels: userId === undefined ? [] : [userChannel(userId)],
  eventCases: SUPPORT_TICKET_EVENT_CASES,
});
