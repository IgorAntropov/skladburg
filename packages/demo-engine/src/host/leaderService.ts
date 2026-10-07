import { create } from '@bufbuild/protobuf';
import {
  ErrorCode,
  type ErrorDetail,
  ErrorDetailSchema,
  FieldViolationSchema,
  ValidationFailedParamsSchema,
} from '@skladburg/contracts/common/v1/error';

import type { IDemoEngine } from '../core/engine/index';
import type {
  EngineClientMessageValue,
  EngineControlMessageValue,
  EngineHostMessageValue,
  EngineRequestMessageValue,
  EngineSubscribeMessageValue,
  HeaderPairValue,
} from '../protocol/index';
import type {
  ILockManager,
  ITimerSource,
} from './hostTypes';

import {
  encodeErrorDetail,
  encodeEvent,
  EngineControlCommand,
  restoreRequest,
  serializeResponse,
} from '../protocol/index';
import { createTabLockName } from './constants';

export interface CreateLeaderServiceOptionsValue {
  checkpointIntervalMs: number;
  engine: IDemoEngine;
  generateId: () => string;
  lockManager: ILockManager | undefined;
  onReset: (epoch: string) => void;
  ownTabId: string;
  sendToTab: (tabId: string, message: EngineHostMessageValue) => void;
  tickIntervalMs: number;
  timers: ITimerSource;
}

export interface ILeaderService {
  epoch: () => string;
  serve: (tabId: string, message: EngineClientMessageValue) => void;
  start: () => void;
  stop: () => Promise<void>;
}

interface InFlightCallValue {
  abort: () => void;
  isAborted: () => boolean;
  tabId: string;
}

interface LeaderSubscriptionValue {
  channel: string;
  headers: HeaderPairValue[];
  pendingEvents: ArrayBuffer[];
  subscriptionId: string;
  tabId: string;
  unsubscribe: (() => void) | undefined;
}

const INVALID_HEADERS_VIOLATION = { fieldPath: 'headers', ruleId: 'headers.invalid' };

const createKey = (tabId: string, id: string): string => `${tabId}\u0000${id}`;

const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError';

export const createLeaderService = (options: CreateLeaderServiceOptionsValue): ILeaderService => {
  const { engine, sendToTab } = options;
  const subscriptions = new Map<string, LeaderSubscriptionValue>();
  const dirtySubscriptions = new Set<LeaderSubscriptionValue>();
  const inFlightCalls = new Map<string, InFlightCallValue>();
  const watchedTabIds = new Set<string>();
  const tabWatchAbort = new AbortController();
  const cancelTimers: (() => void)[] = [];
  let currentTick: Promise<void> | undefined;
  let currentCheckpoint: Promise<void> | undefined;
  let stopPromise: Promise<void> | undefined;
  let isStopping = false;
  let isStopped = false;

  const send = (tabId: string, message: EngineHostMessageValue): void => {
    if (!isStopped) {
      sendToTab(tabId, message);
    }
  };

  const flushEvents = (): void => {
    const dirty = [...dirtySubscriptions];
    dirtySubscriptions.clear();

    for (const subscription of dirty) {
      const events = subscription.pendingEvents;
      subscription.pendingEvents = [];

      if (events.length > 0) {
        send(subscription.tabId, { events, subscriptionId: subscription.subscriptionId, type: 'events' });
      }
    }
  };

  const releaseSubscription = (subscription: LeaderSubscriptionValue): void => {
    subscription.unsubscribe?.();
    subscription.unsubscribe = undefined;
    subscription.pendingEvents = [];
    dirtySubscriptions.delete(subscription);
  };

  const rejectSubscription = (subscription: LeaderSubscriptionValue, detail: ErrorDetail): void => {
    releaseSubscription(subscription);
    subscriptions.delete(createKey(subscription.tabId, subscription.subscriptionId));
    send(subscription.tabId, {
      detail: encodeErrorDetail(detail),
      subscriptionId: subscription.subscriptionId,
      type: 'subscription_denied',
    });
  };

  const createInvalidHeadersDetail = (): ErrorDetail => create(ErrorDetailSchema, {
    code: ErrorCode.VALIDATION_FAILED,
    params: {
      case: 'validationFailed',
      value: create(ValidationFailedParamsSchema, {
        violations: [create(FieldViolationSchema, INVALID_HEADERS_VIOLATION)],
      }),
    },
    traceId: options.generateId(),
  });

  const createInternalDetail = (): ErrorDetail => create(ErrorDetailSchema, {
    code: ErrorCode.INTERNAL,
    traceId: options.generateId(),
  });

  const buildHeaders = (subscription: LeaderSubscriptionValue): Headers | undefined => {
    try {
      return new Headers(subscription.headers);
    }
    catch (error) {
      console.log('> EngineHost -> attachSubscription:', { error, subscriptionId: subscription.subscriptionId });

      return undefined;
    }
  };

  const subscribeToEngine = (subscription: LeaderSubscriptionValue, headers: Headers): ReturnType<IDemoEngine['subscribe']> | undefined => {
    try {
      return engine.subscribe(subscription.channel, headers, (events) => {
        subscription.pendingEvents.push(...events.map(encodeEvent));
        dirtySubscriptions.add(subscription);
      });
    }
    catch (error) {
      console.log('> EngineHost -> attachSubscription:', { error, subscriptionId: subscription.subscriptionId });

      return undefined;
    }
  };

  const attachSubscription = (subscription: LeaderSubscriptionValue): void => {
    const headers = buildHeaders(subscription);

    if (headers === undefined) {
      rejectSubscription(subscription, createInvalidHeadersDetail());

      return;
    }

    const result = subscribeToEngine(subscription, headers);

    if (result === undefined) {
      rejectSubscription(subscription, createInternalDetail());

      return;
    }

    if (result.kind === 'denied') {
      send(subscription.tabId, {
        detail: encodeErrorDetail(result.detail),
        subscriptionId: subscription.subscriptionId,
        type: 'subscription_denied',
      });

      return;
    }

    subscription.unsubscribe = result.unsubscribe;
    send(subscription.tabId, {
      epoch: result.epoch,
      seq: result.seq,
      subscriptionId: subscription.subscriptionId,
      type: 'subscribed',
    });
  };

  const serveSubscribe = (tabId: string, message: EngineSubscribeMessageValue): void => {
    const key = createKey(tabId, message.subscriptionId);
    const existing = subscriptions.get(key);

    if (existing !== undefined) {
      releaseSubscription(existing);
    }

    const subscription: LeaderSubscriptionValue = {
      channel: message.channel,
      headers: message.headers,
      pendingEvents: [],
      subscriptionId: message.subscriptionId,
      tabId,
      unsubscribe: undefined,
    };

    subscriptions.set(key, subscription);
    attachSubscription(subscription);
  };

  const serveUnsubscribe = (tabId: string, subscriptionId: string): void => {
    const key = createKey(tabId, subscriptionId);
    const subscription = subscriptions.get(key);

    if (subscription !== undefined) {
      releaseSubscription(subscription);
      subscriptions.delete(key);
    }
  };

  const beginCall = (tabId: string, requestId: string): InFlightCallValue => {
    let isAborted = false;
    const call: InFlightCallValue = {
      abort: () => {
        isAborted = true;
      },
      isAborted: () => isAborted,
      tabId,
    };
    inFlightCalls.set(createKey(tabId, requestId), call);

    return call;
  };

  const endCall = (tabId: string, requestId: string): void => {
    inFlightCalls.delete(createKey(tabId, requestId));
  };

  const serveRequest = async (tabId: string, message: EngineRequestMessageValue): Promise<void> => {
    const call = beginCall(tabId, message.requestId);

    try {
      const response = await engine.handle(restoreRequest(message));
      flushEvents();

      if (!call.isAborted()) {
        const serialized = await serializeResponse(response, message.requestId);

        if (!call.isAborted()) {
          send(tabId, serialized.message);
        }
      }
    }
    catch (error) {
      console.log('> EngineHost -> serveRequest:', { error, requestId: message.requestId });
      flushEvents();

      if (!call.isAborted()) {
        send(tabId, { requestId: message.requestId, type: 'transport_error' });
      }
    }
    finally {
      endCall(tabId, message.requestId);
    }
  };

  const resubscribeAll = (): void => {
    for (const subscription of [...subscriptions.values()]) {
      releaseSubscription(subscription);

      try {
        attachSubscription(subscription);
      }
      catch (error) {
        console.log('> EngineHost -> resubscribeAll:', { error, subscriptionId: subscription.subscriptionId });
        rejectSubscription(subscription, createInternalDetail());
      }
    }
  };

  const resetEngine = async (): Promise<void> => {
    const epoch = options.generateId();
    await engine.reset(epoch);
    resubscribeAll();
    options.onReset(epoch);
  };

  const serveControl = async (tabId: string, message: EngineControlMessageValue): Promise<void> => {
    const call = beginCall(tabId, message.requestId);

    try {
      if (message.command === EngineControlCommand.RESET) {
        await resetEngine();

        if (!call.isAborted()) {
          send(tabId, { requestId: message.requestId, type: 'control_result' });
        }
      }
      else {
        send(tabId, { personas: [...engine.listPersonas()], requestId: message.requestId, type: 'control_result' });
      }
    }
    catch (error) {
      console.log('> EngineHost -> serveControl:', { command: message.command, error });

      if (!call.isAborted()) {
        send(tabId, { requestId: message.requestId, type: 'transport_error' });
      }
    }
    finally {
      endCall(tabId, message.requestId);
    }
  };

  const dropTab = (tabId: string): void => {
    watchedTabIds.delete(tabId);
    let droppedSubscriptionCount = 0;
    let abortedCallCount = 0;

    for (const [key, subscription] of [...subscriptions]) {
      if (subscription.tabId === tabId) {
        releaseSubscription(subscription);
        subscriptions.delete(key);
        droppedSubscriptionCount += 1;
      }
    }

    for (const call of inFlightCalls.values()) {
      if (call.tabId === tabId) {
        call.abort();
        abortedCallCount += 1;
      }
    }

    if (droppedSubscriptionCount > 0 || abortedCallCount > 0) {
      console.log('> EngineHost -> dropTab:', { abortedCallCount, droppedSubscriptionCount, tabId });
    }
  };

  const handleTabLockGranted = (tabId: string): Promise<void> => {
    dropTab(tabId);

    return Promise.resolve();
  };

  const watchTab = (tabId: string): void => {
    const { lockManager } = options;

    if (lockManager === undefined || tabId === options.ownTabId || watchedTabIds.has(tabId)) {
      return;
    }

    watchedTabIds.add(tabId);
    lockManager
      .request(createTabLockName(tabId), { signal: tabWatchAbort.signal }, () => handleTabLockGranted(tabId))
      .catch((error: unknown) => {
        watchedTabIds.delete(tabId);

        if (!isAbortError(error)) {
          console.log('> EngineHost -> watchTab:', { error, tabId });
        }
      });
  };

  const serve = (tabId: string, message: EngineClientMessageValue): void => {
    if (isStopping) {
      return;
    }

    if (message.type === 'control' || message.type === 'request' || message.type === 'subscribe') {
      watchTab(tabId);
    }

    switch (message.type) {
      case 'abort': {
        inFlightCalls.get(createKey(tabId, message.requestId))?.abort();
        break;
      }
      case 'control':
        void serveControl(tabId, message);
        break;
      case 'request':
        void serveRequest(tabId, message);
        break;
      case 'subscribe':
        serveSubscribe(tabId, message);
        break;
      case 'unsubscribe':
        serveUnsubscribe(tabId, message.subscriptionId);
        break;
    }
  };

  const runTick = async (): Promise<void> => {
    try {
      await engine.tick();
    }
    catch (error) {
      console.log('> EngineHost -> runTick:', { error });
    }

    flushEvents();
  };

  const handleTickTimer = (): void => {
    if (currentTick !== undefined) {
      return;
    }

    currentTick = runTick().finally(() => {
      currentTick = undefined;
    });
  };

  const runCheckpoint = async (): Promise<void> => {
    try {
      await engine.checkpoint();
    }
    catch {
      return;
    }
  };

  const handleCheckpointTimer = (): void => {
    if (currentCheckpoint !== undefined) {
      return;
    }

    currentCheckpoint = runCheckpoint().finally(() => {
      currentCheckpoint = undefined;
    });
  };

  const start = (): void => {
    cancelTimers.push(
      options.timers.setInterval(handleTickTimer, options.tickIntervalMs),
      options.timers.setInterval(handleCheckpointTimer, options.checkpointIntervalMs),
    );
  };

  const performStop = async (): Promise<void> => {
    isStopping = true;
    tabWatchAbort.abort();

    for (const cancel of cancelTimers.splice(0)) {
      cancel();
    }

    await currentTick;
    await currentCheckpoint;
    await runCheckpoint();
    isStopped = true;

    for (const subscription of subscriptions.values()) {
      releaseSubscription(subscription);
    }

    subscriptions.clear();
    inFlightCalls.clear();
  };

  const stop = (): Promise<void> => {
    stopPromise ??= performStop();

    return stopPromise;
  };

  return {
    epoch: () => engine.epoch(),
    serve,
    start,
    stop,
  };
};
