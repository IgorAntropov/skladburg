import type { QueryClient } from '@tanstack/react-query';

import type {
  IRealtimeChannel,
  RealtimeBatchValue,
} from '../realtime/realtimeTypes';
import type { IDemoControl } from '../transport/demo';

import { invalidateQueriesByChannel } from './invalidateQueriesByChannel';

export interface SyncQueriesWithRealtimeOptionsValue {
  demoControl: IDemoControl | undefined;
  queryClient: QueryClient;
  realtime: IRealtimeChannel;
}

export const syncQueriesWithRealtime = (options: SyncQueriesWithRealtimeOptionsValue): () => void => {
  const { demoControl, queryClient, realtime } = options;
  const queryCache = queryClient.getQueryCache();
  const channelSubscriptions = new Map<string, () => void>();
  let isStopped = false;

  const collectDesiredChannels = (): Set<string> => {
    const channels = new Set<string>();

    for (const query of queryCache.getAll()) {
      for (const channel of query.meta?.channels ?? []) {
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

    void invalidateQueriesByChannel(queryClient, channel);
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
