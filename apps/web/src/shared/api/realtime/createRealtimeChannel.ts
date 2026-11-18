import type { Event } from '@skladburg/contracts/event/v1/event';

import type { IActingContextStore } from '../context/actingContextTypes';
import type { ApiErrorValue } from '../errors/apiErrorTypes';
import type {
  IFrameScheduler,
  IRealtimeChannel,
  IRealtimeSource,
  RealtimeBatchValue,
  RealtimePositionValue,
} from './realtimeTypes';

export interface CreateRealtimeChannelOptionsValue {
  actingContext: IActingContextStore;
  frameScheduler: IFrameScheduler;
  source: IRealtimeSource;
}

interface ChannelEntryValue {
  channel: string;
  denied: ApiErrorValue | undefined;
  epoch: string | undefined;
  generation: number;
  isResyncPending: boolean;
  lastSeq: bigint;
  listeners: readonly ListenerRecordValue[];
  pendingEvents: Event[] | undefined;
  unsubscribeSource: () => void;
}

interface ListenerRecordValue {
  isActive: boolean;
  listener: (batch: RealtimeBatchValue) => void;
  onSubscribed: (() => void) | undefined;
}

const RESYNC_BATCH: RealtimeBatchValue = { kind: 'resync' };

const doNothing = (): void => undefined;

export const createRealtimeChannel = (options: CreateRealtimeChannelOptionsValue): IRealtimeChannel => {
  const { actingContext, frameScheduler, source } = options;
  const entries = new Map<string, ChannelEntryValue>();
  const dirtyEntries = new Set<ChannelEntryValue>();
  let appliedContext = actingContext.get();
  let cancelScheduledFlush: (() => void) | undefined;
  let isFlushScheduled = false;
  let isStopped = false;

  const notify = (entry: ChannelEntryValue, batch: RealtimeBatchValue): void => {
    for (const record of entry.listeners) {
      if (!record.isActive) {
        continue;
      }

      try {
        record.listener(batch);
      }
      catch (error) {
        console.log('> RealtimeChannel -> notify:', { channel: entry.channel, error });
      }
    }
  };

  const flushEntry = (entry: ChannelEntryValue): void => {
    const { denied, isResyncPending, pendingEvents } = entry;
    entry.denied = undefined;
    entry.isResyncPending = false;
    entry.pendingEvents = undefined;

    if (denied !== undefined) {
      notify(entry, { error: denied, kind: 'denied' });
    }

    if (isResyncPending) {
      if (denied === undefined) {
        notify(entry, RESYNC_BATCH);
      }
    }
    else if (pendingEvents !== undefined) {
      notify(entry, { events: pendingEvents, kind: 'events' });
    }
  };

  const flushDirtyEntries = (): void => {
    isFlushScheduled = false;
    cancelScheduledFlush = undefined;

    if (isStopped || dirtyEntries.size === 0) {
      return;
    }

    const flushed = Array.from(dirtyEntries);
    dirtyEntries.clear();

    for (const entry of flushed) {
      flushEntry(entry);
    }
  };

  const markDirty = (entry: ChannelEntryValue): void => {
    dirtyEntries.add(entry);

    if (isFlushScheduled || isStopped) {
      return;
    }

    isFlushScheduled = true;
    cancelScheduledFlush = frameScheduler.schedule(flushDirtyEntries);
  };

  const requestResync = (entry: ChannelEntryValue): void => {
    entry.isResyncPending = true;
    entry.pendingEvents = undefined;
    markDirty(entry);
  };

  const acceptEvents = (entry: ChannelEntryValue, events: readonly Event[]): void => {
    for (const event of events) {
      const { epoch, lastSeq } = entry;
      if (epoch === undefined) {
        requestResync(entry);
        continue;
      }

      if (event.epoch === epoch && event.seq <= lastSeq) {
        continue;
      }

      entry.epoch = event.epoch;
      entry.lastSeq = event.seq;

      if (event.epoch !== epoch || event.seq !== lastSeq + 1n) {
        requestResync(entry);
      }
      else if (!entry.isResyncPending) {
        (entry.pendingEvents ??= []).push(event);
        markDirty(entry);
      }
    }
  };

  const acceptPosition = (entry: ChannelEntryValue, position: RealtimePositionValue): void => {
    const { epoch, lastSeq } = entry;
    if (epoch === position.epoch && position.seq <= lastSeq) {
      return;
    }

    entry.epoch = position.epoch;
    entry.lastSeq = position.seq;
    if (epoch === undefined) {
      entry.listeners.forEach(({ onSubscribed }) => {
        onSubscribed?.();
      });
    }
    else {
      requestResync(entry);
    }
  };

  const openSource = (entry: ChannelEntryValue): void => {
    entry.generation += 1;
    const { generation } = entry;

    entry.unsubscribeSource = source.subscribe(entry.channel, actingContext.get(), {
      onDenied: (error) => {
        if (entry.generation !== generation) {
          return;
        }

        entry.denied = error;
        markDirty(entry);
      },
      onEvents: (events) => {
        if (entry.generation === generation) {
          acceptEvents(entry, events);
        }
      },
      onSubscribed: (position) => {
        if (entry.generation === generation) {
          acceptPosition(entry, position);
        }
      },
    });
  };

  const closeSource = (entry: ChannelEntryValue): void => {
    entry.generation += 1;
    entry.unsubscribeSource();
    entry.unsubscribeSource = doNothing;
  };

  const handleActingContextChange = (): void => {
    const next = actingContext.get();

    if (next.organizationId === appliedContext.organizationId && next.userId === appliedContext.userId) {
      return;
    }

    appliedContext = next;
    console.log('> RealtimeChannel -> handleActingContextChange:', { channelCount: entries.size });

    for (const entry of entries.values()) {
      closeSource(entry);
      entry.denied = undefined;
      entry.epoch = undefined;
      requestResync(entry);
      openSource(entry);
    }
  };

  const obtainEntry = (channel: string): ChannelEntryValue => {
    const existing = entries.get(channel);

    if (existing !== undefined) {
      return existing;
    }

    const entry: ChannelEntryValue = {
      channel,
      denied: undefined,
      epoch: undefined,
      generation: 0,
      isResyncPending: false,
      lastSeq: 0n,
      listeners: [],
      pendingEvents: undefined,
      unsubscribeSource: doNothing,
    };
    entries.set(channel, entry);
    openSource(entry);

    return entry;
  };

  const releaseEntry = (entry: ChannelEntryValue, record: ListenerRecordValue): void => {
    entry.listeners = entry.listeners.filter(candidate => candidate !== record);

    if (entry.listeners.length > 0) {
      return;
    }

    closeSource(entry);
    dirtyEntries.delete(entry);

    if (entries.get(entry.channel) === entry) {
      entries.delete(entry.channel);
    }

    if (dirtyEntries.size === 0 && isFlushScheduled) {
      cancelScheduledFlush?.();
      cancelScheduledFlush = undefined;
      isFlushScheduled = false;
    }
  };

  const subscribe: IRealtimeChannel['subscribe'] = (channel, listener, onSubscribed) => {
    if (isStopped) {
      return doNothing;
    }

    const record: ListenerRecordValue = { isActive: true, listener, onSubscribed };
    const entry = obtainEntry(channel);
    entry.listeners = [...entry.listeners, record];
    if (entry.epoch !== undefined) {
      onSubscribed?.();
    }

    return () => {
      if (!record.isActive) {
        return;
      }

      record.isActive = false;
      releaseEntry(entry, record);
    };
  };

  const unsubscribeFromContext = actingContext.subscribe(handleActingContextChange);

  const stop = (): void => {
    if (isStopped) {
      return;
    }

    isStopped = true;
    cancelScheduledFlush?.();
    cancelScheduledFlush = undefined;
    isFlushScheduled = false;
    unsubscribeFromContext();

    for (const entry of entries.values()) {
      for (const record of entry.listeners) {
        record.isActive = false;
      }

      closeSource(entry);
    }

    entries.clear();
    dirtyEntries.clear();
  };

  return { stop, subscribe };
};
