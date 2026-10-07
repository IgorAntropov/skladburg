import type { ErrorDetail } from '@skladburg/contracts/common/v1/error';
import type { Event } from '@skladburg/contracts/event/v1/event';

import type { EngineChannelPositionValue } from '../../core/events/index';
import type { HostFixtureValue } from './hostHarness';

export interface RecordedSubscriptionValue {
  denied: ErrorDetail[];
  events: (readonly Event[])[];
  positions: EngineChannelPositionValue[];
  unsubscribe: () => void;
}

export const subscribeRecorded = (fixture: HostFixtureValue, channel: string, headers: Headers): RecordedSubscriptionValue => {
  const denied: ErrorDetail[] = [];
  const events: (readonly Event[])[] = [];
  const positions: EngineChannelPositionValue[] = [];

  const unsubscribe = fixture.connection.subscribe(channel, headers, {
    onDenied: (detail) => {
      denied.push(detail);
    },
    onEvents: (batch) => {
      events.push(batch);
    },
    onSubscribed: (position) => {
      positions.push(position);
    },
  });

  return { denied, events, positions, unsubscribe };
};
