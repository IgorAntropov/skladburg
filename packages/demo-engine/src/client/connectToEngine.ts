import type { Event } from '@skladburg/contracts/event/v1/event';

import {
  Code,
  ConnectError,
} from '@connectrpc/connect';

import type {
  DemoPersonaListItemValue,
  EngineClientMessageValue,
  EngineControlResultMessageValue,
  EngineHostMessageValue,
  EngineResponseMessageValue,
  IEnginePort,
} from '../protocol/index';
import type {
  EngineConnectionOptionsValue,
  EngineConnectionStatusValue,
  EngineSubscriptionHandlersValue,
  IEngineConnection,
} from './types';

import {
  decodeErrorDetail,
  decodeEvent,
  ENGINE_REQUEST_TIMEOUT_MS,
  EngineControlCommand,
  parseEngineHostMessage,
  restoreResponse,
  serializeRequest,
} from '../protocol/index';

type EngineReplyMessageValue = EngineControlResultMessageValue | EngineResponseMessageValue;

interface PendingReplyValue {
  fail: (reason: unknown) => void;
  succeed: (reply: EngineReplyMessageValue) => void;
}

type ReplyOutcomeValue
  = | { kind: 'failed'; reason: unknown }
    | { kind: 'replied'; reply: EngineReplyMessageValue };

const createUnavailableError = (reason: string): ConnectError =>
  new ConnectError(`The demo engine is unavailable: ${reason}`, Code.Unavailable);

const invokeHandler = (handlerName: string, call: () => void): void => {
  try {
    call();
  }
  catch (error) {
    console.log('> EngineConnection -> invokeHandler:', { error, handlerName });
  }
};

export const connectToEngine = (port: IEnginePort, options: EngineConnectionOptionsValue = {}): IEngineConnection => {
  const requestTimeoutMs = options.requestTimeoutMs ?? ENGINE_REQUEST_TIMEOUT_MS;
  const pendingReplies = new Map<string, PendingReplyValue>();
  const subscriptions = new Map<string, EngineSubscriptionHandlersValue>();
  const resetListeners = new Set<(epoch: string) => void>();
  const statusListeners = new Set<(status: EngineConnectionStatusValue) => void>();
  let lastStatus: EngineConnectionStatusValue | undefined;
  let isClosed = false;
  let idCounter = 0;

  const nextId = (prefix: string): string => {
    idCounter += 1;

    return `${prefix}-${String(idCounter)}`;
  };

  const postToEngine = (message: EngineClientMessageValue, transfer: Transferable[] = []): void => {
    port.postMessage(message, transfer);
  };

  const sendAbort = (requestId: string): void => {
    try {
      postToEngine({ requestId, type: 'abort' });
    }
    catch (error) {
      console.log('> EngineConnection -> sendAbort:', { error, requestId });
    }
  };

  const assertAvailable = (): void => {
    if (isClosed) {
      throw createUnavailableError('the connection is closed');
    }

    if (lastStatus?.state === 'unavailable') {
      throw createUnavailableError('the engine is not running');
    }
  };

  const awaitReply = async (
    requestId: string,
    send: () => void,
    signal: AbortSignal | undefined,
  ): Promise<EngineReplyMessageValue> => {
    const outcome = await new Promise<ReplyOutcomeValue>((resolve) => {
      const finish = (): void => {
        clearTimeout(timerId);
        signal?.removeEventListener('abort', handleAbort);
        pendingReplies.delete(requestId);
      };

      const fail = (reason: unknown): void => {
        finish();
        resolve({ kind: 'failed', reason });
      };

      const handleAbort = (): void => {
        fail(signal?.reason);
        sendAbort(requestId);
      };

      const handleTimeout = (): void => {
        fail(createUnavailableError('the request timed out'));
        sendAbort(requestId);
      };

      const timerId = setTimeout(handleTimeout, requestTimeoutMs);

      pendingReplies.set(requestId, {
        fail,
        succeed: (reply) => {
          finish();
          resolve({ kind: 'replied', reply });
        },
      });
      signal?.addEventListener('abort', handleAbort, { once: true });

      try {
        send();
      }
      catch (error) {
        console.log('> EngineConnection -> awaitReply:', { error, requestId });
        fail(createUnavailableError('the message could not be sent'));
      }
    });

    if (outcome.kind === 'failed') {
      throw outcome.reason;
    }

    return outcome.reply;
  };

  const fetchFromEngine: typeof globalThis.fetch = async (input, init) => {
    assertAvailable();

    const request = new Request(input, init);
    const { signal } = request;
    signal.throwIfAborted();
    const requestId = nextId('request');
    const { message, transfer } = await serializeRequest(request, requestId);
    signal.throwIfAborted();
    assertAvailable();

    const reply = await awaitReply(requestId, () => {
      postToEngine(message, transfer);
    }, signal);

    if (reply.type !== 'response') {
      throw createUnavailableError('the reply does not match the request');
    }

    try {
      return restoreResponse(reply);
    }
    catch (error) {
      console.log('> EngineConnection -> fetchFromEngine:', { error, requestId });

      throw createUnavailableError('the reply could not be restored');
    }
  };

  const callControl = async (command: EngineControlCommand): Promise<EngineControlResultMessageValue> => {
    assertAvailable();

    const requestId = nextId('control');
    const reply = await awaitReply(requestId, () => {
      postToEngine({ command, requestId, type: 'control' });
    }, undefined);

    if (reply.type !== 'control_result') {
      throw createUnavailableError('the reply does not match the request');
    }

    return reply;
  };

  const listPersonas = async (): Promise<readonly DemoPersonaListItemValue[]> => {
    const { personas } = await callControl(EngineControlCommand.LIST_PERSONAS);

    if (personas === undefined) {
      throw createUnavailableError('the personas are missing in the reply');
    }

    return personas;
  };

  const reset = async (): Promise<void> => {
    await callControl(EngineControlCommand.RESET);
  };

  const subscribe = (channel: string, headers: Headers, handlers: EngineSubscriptionHandlersValue): (() => void) => {
    if (isClosed) {
      return () => undefined;
    }

    const subscriptionId = nextId('subscription');
    subscriptions.set(subscriptionId, handlers);
    postToEngine({ channel, headers: Array.from(headers.entries()), subscriptionId, type: 'subscribe' });

    return () => {
      if (!subscriptions.delete(subscriptionId)) {
        return;
      }

      postToEngine({ subscriptionId, type: 'unsubscribe' });
    };
  };

  const addListener = <TListener>(listeners: Set<TListener>, listener: TListener): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const onStatus = (listener: (status: EngineConnectionStatusValue) => void): (() => void) => {
    const unsubscribe = addListener(statusListeners, listener);

    if (lastStatus !== undefined) {
      const status = lastStatus;
      invokeHandler('onStatus', () => {
        listener(status);
      });
    }

    return unsubscribe;
  };

  const publishStatus = (status: EngineConnectionStatusValue): void => {
    lastStatus = status;

    for (const listener of [...statusListeners]) {
      invokeHandler('onStatus', () => {
        listener(status);
      });
    }
  };

  const rejectPendingReplies = (reason: string): void => {
    for (const [requestId, pending] of [...pendingReplies]) {
      pending.fail(createUnavailableError(reason));
      sendAbort(requestId);
    }
  };

  const decodeEvents = (buffers: readonly ArrayBuffer[]): Event[] | undefined => {
    try {
      return buffers.map(decodeEvent);
    }
    catch (error) {
      console.log('> EngineConnection -> decodeEvents:', { error });

      return undefined;
    }
  };

  const handleHostMessage = (message: EngineHostMessageValue): void => {
    switch (message.type) {
      case 'control_result':
      case 'response':
        pendingReplies.get(message.requestId)?.succeed(message);
        break;
      case 'engine_unavailable':
        publishStatus({ reason: message.reason, state: 'unavailable' });
        rejectPendingReplies('the engine is not running');
        break;
      case 'events': {
        const handlers = subscriptions.get(message.subscriptionId);
        const events = handlers === undefined ? undefined : decodeEvents(message.events);

        if (handlers !== undefined && events !== undefined) {
          invokeHandler('onEvents', () => {
            handlers.onEvents(events);
          });
        }

        break;
      }
      case 'reset_done':
        for (const listener of [...resetListeners]) {
          invokeHandler('onReset', () => {
            listener(message.epoch);
          });
        }

        break;
      case 'status': {
        const { coordination, epoch, role, storage, storageHealth } = message;
        publishStatus({ coordination, epoch, role, state: 'ready', storage, storageHealth });
        break;
      }
      case 'subscribed': {
        const { epoch, seq } = message;
        const handlers = subscriptions.get(message.subscriptionId);

        if (handlers !== undefined) {
          invokeHandler('onSubscribed', () => {
            handlers.onSubscribed({ epoch, seq });
          });
        }

        break;
      }
      case 'subscription_denied': {
        const handlers = subscriptions.get(message.subscriptionId);

        if (handlers !== undefined) {
          invokeHandler('onDenied', () => {
            handlers.onDenied(decodeErrorDetail(message.detail));
          });
        }

        break;
      }
      case 'transport_error':
        pendingReplies.get(message.requestId)?.fail(createUnavailableError('the engine reported a transport error'));
        break;
    }
  };

  const handleMessage = (event: MessageEvent): void => {
    const message = parseEngineHostMessage(event.data);

    if (message !== undefined) {
      handleHostMessage(message);
    }
  };

  const close = (): void => {
    if (isClosed) {
      return;
    }

    isClosed = true;
    port.removeEventListener('message', handleMessage);

    for (const pending of [...pendingReplies.values()]) {
      pending.fail(createUnavailableError('the connection is closed'));
    }

    for (const subscriptionId of [...subscriptions.keys()]) {
      postToEngine({ subscriptionId, type: 'unsubscribe' });
    }

    subscriptions.clear();
    resetListeners.clear();
    statusListeners.clear();
  };

  port.addEventListener('message', handleMessage);
  port.start?.();

  return {
    close,
    control: {
      listPersonas,
      onReset: listener => addListener(resetListeners, listener),
      reset,
    },
    fetch: fetchFromEngine,
    onStatus,
    subscribe,
  };
};
