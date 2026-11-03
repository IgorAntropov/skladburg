import { marketChannel } from '@skladburg/contracts/runtime';

import type {
  ApiQueryMetaValue,
  RealtimeEventCaseValue,
} from '@/shared/api';

import { createOrganizationQueryMeta } from '@/shared/api';

const LISTING_EVENT_CASES: readonly RealtimeEventCaseValue[] = ['listingsChanged'];

export const createShowcaseQueryMeta = (): ApiQueryMetaValue => ({
  channels: [marketChannel()],
  eventCases: LISTING_EVENT_CASES,
});

export const createOwnListingQueryMeta = (organizationId: string | undefined): ApiQueryMetaValue => (
  createOrganizationQueryMeta(organizationId, LISTING_EVENT_CASES)
);
