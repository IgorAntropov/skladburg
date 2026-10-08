import type { IEngineConnection } from '@skladburg/demo-engine/client';

import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import { DEMO_USER_HEADER } from '@skladburg/demo-engine/client';

import type { ActingContextValue } from '../../context/actingContextTypes';
import type { IRealtimeSource } from '../../realtime/realtimeTypes';

import { apiErrorFromDetail } from '../../errors/apiErrorFromDetail';

const createSubscriptionHeaders = (context: ActingContextValue): Headers => {
  const headers = new Headers();

  if (context.organizationId !== undefined && context.organizationId !== '') {
    headers.set(ACTING_ORGANIZATION_HEADER, context.organizationId);
  }

  if (context.userId !== undefined && context.userId !== '') {
    headers.set(DEMO_USER_HEADER, context.userId);
  }

  return headers;
};

export const createDemoRealtimeSource = (connection: IEngineConnection): IRealtimeSource => ({
  subscribe: (channel, context, handlers) => connection.subscribe(channel, createSubscriptionHeaders(context), {
    onDenied: (detail) => {
      handlers.onDenied(apiErrorFromDetail(detail));
    },
    onEvents: handlers.onEvents,
    onSubscribed: handlers.onSubscribed,
  }),
});
