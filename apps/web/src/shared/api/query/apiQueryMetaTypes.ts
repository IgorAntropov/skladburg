import type { Event } from '@skladburg/contracts/event/v1/event';

export interface ApiQueryMetaValue extends Record<string, unknown> {
  channels?: readonly string[];
  eventCases?: readonly RealtimeEventCaseValue[];
}

export type RealtimeEventCaseValue = NonNullable<Event['payload']['case']>;

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: ApiQueryMetaValue;
  }
}
