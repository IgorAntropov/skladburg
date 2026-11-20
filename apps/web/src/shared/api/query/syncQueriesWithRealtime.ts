import type { Event } from '@skladburg/contracts/event/v1/event';
import type {
  QueryCacheNotifyEvent,
  QueryClient,
} from '@tanstack/react-query';

import type {
  IRealtimeChannel,
  RealtimeBatchValue,
} from '../realtime/realtimeTypes';
import type { IDemoControl } from '../transport/demo';
import type { RealtimeEventCaseValue } from './apiQueryMetaTypes';

import { invalidateQueriesByChannel } from './invalidateQueriesByChannel';

const EMPTY_CHANNELS: readonly string[] = [];

export interface SyncQueriesWithRealtimeOptionsValue {
  demoControl: IDemoControl | undefined;
  queryClient: QueryClient;
  realtime: IRealtimeChannel;
}

const collectEventCases = (events: readonly Event[]): ReadonlySet<RealtimeEventCaseValue> | undefined => {
  const eventCases = new Set<RealtimeEventCaseValue>();

  for (const { payload } of events) {
    if (payload.case === undefined) {
      return undefined;
    }

    eventCases.add(payload.case);
  }

  return eventCases;
};

export const syncQueriesWithRealtime = (options: SyncQueriesWithRealtimeOptionsValue): () => void => {
  const { demoControl, queryClient, realtime } = options;
  const queryCache = queryClient.getQueryCache();
  const channelSubscriptions = new Map<string, () => void>();
  const channelsByQuery = new WeakMap<QueryCacheNotifyEvent['query'], readonly string[]>();
  let isStopped = false;

  const collectDesiredChannels = (): Set<string> => {
    const channels = new Set<string>();

    for (const query of queryCache.getAll()) {
      const queryChannels = query.meta?.channels ?? EMPTY_CHANNELS;
      channelsByQuery.set(query, queryChannels);
      for (const channel of queryChannels) {
        channels.add(channel);
      }
    }

    return channels;
  };

  const handleBatch = (channel: string, batch: RealtimeBatchValue): void => {
    if (batch.kind === 'denied') {
      console.warn('> syncQueriesWithRealtime -> denied:', { channel, code: batch.error.code });

      return;
    }

    const eventCases = batch.kind === 'events' ? collectEventCases(batch.events) : undefined;

    void invalidateQueriesByChannel(queryClient, channel, eventCases);
  };

  const reconcileChannels = (): void => {
    if (isStopped) {
      return;
    }

    const desiredChannels = collectDesiredChannels();

    for (const [channel, unsubscribe] of channelSubscriptions) {
      if (!desiredChannels.has(channel)) {
        channelSubscriptions.delete(channel);
        unsubscribe();
        console.log('> syncQueriesWithRealtime -> unsubscribe:', { channel });
      }
    }

    for (const channel of desiredChannels) {
      if (!channelSubscriptions.has(channel)) {
        channelSubscriptions.set(channel, realtime.subscribe(channel, (batch) => {
          handleBatch(channel, batch);
        }));
        console.log('> syncQueriesWithRealtime -> subscribe:', { channel });
      }
    }
  };

  const unsubscribeFromCache = queryCache.subscribe((event) => {
    if (event.type === 'added' || event.type === 'removed') {
      reconcileChannels();
      return;
    }

    const current = event.query.meta?.channels ?? EMPTY_CHANNELS;
    const prev = channelsByQuery.get(event.query) ?? EMPTY_CHANNELS;
    if (current !== prev) {
      channelsByQuery.set(event.query, current);
      if (current.length !== prev.length || current.some((channel, index) => channel !== prev[index])) {
        reconcileChannels();
      }
    }
  });

  const unsubscribeFromReset = demoControl?.onReset((epoch) => {
    console.log('> syncQueriesWithRealtime -> reset:', { epoch });
    void queryClient.invalidateQueries();
  });

  reconcileChannels();

  return () => {
    if (isStopped) {
      return;
    }

    isStopped = true;
    unsubscribeFromCache();
    unsubscribeFromReset?.();

    for (const unsubscribe of channelSubscriptions.values()) {
      unsubscribe();
    }

    channelSubscriptions.clear();
  };
};
