import { organizationChannel } from '@skladburg/contracts/runtime';

import type {
  ApiQueryMetaValue,
  RealtimeEventCaseValue,
} from './apiQueryMetaTypes';

const NO_ORGANIZATION_SCOPE = 'none';

export const getOrganizationScope = (organizationId: string | undefined): string => organizationId ?? NO_ORGANIZATION_SCOPE;

export const RESYNC_ONLY_EVENT_CASES: readonly RealtimeEventCaseValue[] = [];

export const createOrganizationQueryMeta = (
  organizationId: string | undefined,
  eventCases: readonly RealtimeEventCaseValue[],
): ApiQueryMetaValue => ({
  channels: organizationId === undefined ? [] : [organizationChannel(organizationId)],
  eventCases,
});
