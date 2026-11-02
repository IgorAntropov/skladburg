import {
  organizationChannel,
  userChannel,
} from '@skladburg/contracts/runtime';

import type {
  ApiQueryMetaValue,
  RealtimeEventCaseValue,
} from '@/shared/api';

export const NO_SESSION_SCOPE = 'none';

const SESSION_EVENT_CASES: readonly RealtimeEventCaseValue[] = ['supportAccessChanged', 'userChanged'];

export const getSessionScope = (id: string | undefined): string => id ?? NO_SESSION_SCOPE;

export const createSessionQueryMeta = (
  organizationId: string | undefined,
  userId: string | undefined,
): ApiQueryMetaValue => ({
  channels: [
    ...organizationId === undefined ? [] : [organizationChannel(organizationId)],
    ...userId === undefined ? [] : [userChannel(userId)],
  ],
  eventCases: SESSION_EVENT_CASES,
});
