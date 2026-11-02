import { marketChannel } from '@skladburg/contracts/runtime';

import type {
  ApiQueryMetaValue,
  RealtimeEventCaseValue,
} from '@/shared/api';

const SHOWCASE_EVENT_CASES: readonly RealtimeEventCaseValue[] = ['listingsChanged'];

export const createShowcaseQueryMeta = (): ApiQueryMetaValue => ({
  channels: [marketChannel()],
  eventCases: SHOWCASE_EVENT_CASES,
});
