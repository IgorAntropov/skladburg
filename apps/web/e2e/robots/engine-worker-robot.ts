import type {
  JSHandle,
  Page,
  Route,
} from '@playwright/test';
import type { ErrorDetail } from '@skladburg/contracts/common/v1/error';
import type { Event } from '@skladburg/contracts/event/v1/event';

import { fromBinary } from '@bufbuild/protobuf';
import { ErrorDetailSchema } from '@skladburg/contracts/common/v1/error';
import { EventSchema } from '@skladburg/contracts/event/v1/event';
import { randomUUID } from 'node:crypto';
import {
  readdirSync,
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const ASSET_DIRECTORY = resolve(import.meta.dirname, '../../dist/assets');
const DOCUMENT_ROUTE = '**/skladburg/';

export interface EngineWorkerRobotValue {
  call: (methodPath: string, body: Uint8Array) => Promise<Uint8Array>;
  hasRequestedChunk: (name: string) => boolean;
  hasReset: () => Promise<boolean>;
  readEvents: (subscriptionId: string) => Promise<Event[]>;
  readStartup: () => Promise<undefined | WorkerStartupValue>;
  request: (methodPath: string, body: Uint8Array) => Promise<WorkerResponseValue>;
  reset: () => Promise<'control_result' | 'transport_error'>;
  stop: () => Promise<void>;
  subscribe: (channel: string) => Promise<WorkerSubscriptionValue>;
}

export interface WorkerActingContextValue {
  organizationId: string;
  userId: string;
}

export interface WorkerResponseValue {
  body: Uint8Array;
  headers: [string, string][];
  status: number;
}

export type WorkerSubscriptionValue
  = | { epoch: string; id: string; kind: 'subscribed' }
    | { error: ErrorDetail; id: string; kind: 'denied' };

type BrowserSubscriptionValue
  = | { detail: number[]; kind: 'denied' }
    | { epoch: string; kind: 'subscribed' };

const DEFAULT_ACTING_CONTEXT: WorkerActingContextValue = {
  organizationId: '10000002-0000-4000-8000-000000000000',
  userId: '20000002-0000-4000-8000-000000000000',
};

export type WorkerStartupValue
  = | { epoch: string; kind: 'ready'; storage: string }
    | { kind: 'unavailable' };

interface BrowserWorkerValue {
  messages: unknown[];
  worker: Worker;
}

type WorkerResultValue
  = | { body: number[]; headers: [string, string][]; status: number; type: 'response' }
    | { type: 'control_result' | 'transport_error' };

const findWorkerFileName = (): string => {
  const files = readdirSync(ASSET_DIRECTORY).flatMap((fileName): string[] => {
    if (!/^worker-.*\.js$/u.test(fileName)) {
      return [];
    }
    const source = readFileSync(resolve(ASSET_DIRECTORY, fileName), 'utf8');
    const entry = /new Worker\([`'"][^`'"]*\/([^/`'"]+\.js)[`'"]/u.exec(source)?.[1];
    return entry === undefined ? [] : [entry];
  });
  const [fileName] = files;

  if (files.length !== 1 || fileName === undefined) {
    throw new Error('Expected one production engine Worker');
  }

  return fileName;
};

export const createEngineWorkerRobot = async (
  page: Page,
  actingContext: WorkerActingContextValue = DEFAULT_ACTING_CONTEXT,
): Promise<EngineWorkerRobotValue> => {
  const requests: string[] = [];
  const context = page.context();
  const handleRequest = (request: { url: () => string }): void => {
    requests.push(request.url());
  };
  const handleDocument = (route: Route): Promise<void> =>
    route.fulfill({ body: '<!doctype html><title>Worker</title>', contentType: 'text/html' });
  context.on('request', handleRequest);
  await page.route(DOCUMENT_ROUTE, handleDocument);
  await page.goto('./');
  const handle: JSHandle<BrowserWorkerValue> = await page.evaluateHandle((fileName): BrowserWorkerValue => {
    const worker = new Worker(new URL(`assets/${fileName}`, location.href), { type: 'module' });
    const messages: unknown[] = [];
    worker.addEventListener('message', (event): void => {
      messages.push(event.data);
    });

    return { messages, worker };
  }, findWorkerFileName());

  const send = async (methodPath: string | undefined, body: Uint8Array | undefined): Promise<WorkerResultValue> =>
    handle.evaluate(async ({ worker }, request): Promise<WorkerResultValue> => {
      const requestId = crypto.randomUUID();

      return new Promise((resolveResponse, reject) => {
        const cleanup = (): void => {
          clearTimeout(timeout);
          worker.removeEventListener('message', handleMessage);
          worker.removeEventListener('error', handleError);
        };
        const handleError = (event: ErrorEvent): void => {
          cleanup();
          reject(new Error(event.message));
        };
        const handleMessage = (event: MessageEvent): void => {
          const message: unknown = event.data;

          if (typeof message !== 'object' || message === null || !('requestId' in message) || message.requestId !== requestId) {
            return;
          }

          cleanup();

          if ('type' in message && (message.type === 'control_result' || message.type === 'transport_error')) {
            resolveResponse({ type: message.type });

            return;
          }

          if ('type' in message && message.type === 'response' && 'status' in message && typeof message.status === 'number'
            && 'body' in message && message.body instanceof ArrayBuffer) {
            const headers: [string, string][] = [];
            if ('headers' in message && Array.isArray(message.headers)) {
              for (const header of message.headers) {
                if (Array.isArray(header) && typeof header[0] === 'string' && typeof header[1] === 'string') {
                  headers.push([header[0], header[1]]);
                }
              }
            }
            resolveResponse({ body: Array.from(new Uint8Array(message.body)), headers, status: message.status, type: 'response' });

            return;
          }

          reject(new Error('Unexpected production Worker response'));
        };
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Production Worker request timed out'));
        }, 15_000);

        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);
        worker.postMessage(request.methodPath === undefined
          ? { command: 'reset', requestId, type: 'control' }
          : {
              body: Uint8Array.from(request.body ?? []).buffer,
              headers: [
                ['content-type', 'application/proto'],
                ['connect-protocol-version', '1'],
                ['x-demo-user-id', request.actingContext.userId],
                ['x-acting-organization-id', request.actingContext.organizationId],
              ],
              method: 'POST',
              requestId,
              type: 'request',
              url: `https://demo-engine.invalid/${request.methodPath}`,
            });
      });
    }, { actingContext, body: body === undefined ? undefined : Array.from(body), methodPath });

  return {
    call: async (methodPath, body): Promise<Uint8Array> => {
      const result = await send(methodPath, body);

      if (result.type !== 'response' || result.status !== 200) {
        throw new Error(`Production Worker request failed: ${JSON.stringify(result)}`);
      }

      return Uint8Array.from(result.body);
    },
    hasRequestedChunk: name => requests.some(url => new URL(url).pathname.split('/').at(-1)?.startsWith(`${name}-`) === true),
    hasReset: () => handle.evaluate(({ messages }): boolean =>
      messages.some(message => typeof message === 'object' && message !== null && 'type' in message && message.type === 'reset_done'),
    ),
    readEvents: async (subscriptionId): Promise<Event[]> => {
      const events = await handle.evaluate(({ messages }, id): number[][] => messages.flatMap((message): number[][] => {
        if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== 'events'
          || !('subscriptionId' in message) || message.subscriptionId !== id || !('events' in message)
          || !Array.isArray(message.events)) {
          return [];
        }
        return message.events.flatMap((event: unknown): number[][] =>
          event instanceof ArrayBuffer ? [Array.from(new Uint8Array(event))] : [],
        );
      }), subscriptionId);
      return events.map(event => fromBinary(EventSchema, Uint8Array.from(event)));
    },
    readStartup: () => handle.evaluate(({ messages }): undefined | WorkerStartupValue => {
      for (const message of messages.toReversed()) {
        if (typeof message !== 'object' || message === null || !('type' in message)) {
          continue;
        }

        if (message.type === 'engine_unavailable') {
          return { kind: 'unavailable' };
        }

        if (message.type === 'status' && 'epoch' in message && typeof message.epoch === 'string'
          && 'storage' in message && typeof message.storage === 'string') {
          return { epoch: message.epoch, kind: 'ready', storage: message.storage };
        }
      }

      return undefined;
    }),
    request: async (methodPath, body): Promise<WorkerResponseValue> => {
      const result = await send(methodPath, body);
      if (result.type !== 'response') {
        throw new Error(`Production Worker transport failed: ${result.type}`);
      }
      return { body: Uint8Array.from(result.body), headers: result.headers, status: result.status };
    },
    reset: async (): Promise<'control_result' | 'transport_error'> => {
      const result = await send(undefined, undefined);

      if (result.type === 'response') {
        throw new Error('Unexpected RPC response to reset');
      }

      return result.type;
    },
    stop: async (): Promise<void> => {
      await handle.evaluate(({ worker }): void => {
        worker.terminate();
      });
      await handle.dispose();
      context.off('request', handleRequest);
      await page.unroute(DOCUMENT_ROUTE, handleDocument);
    },
    subscribe: async (channel): Promise<WorkerSubscriptionValue> => {
      const subscriptionId = randomUUID();
      const result = await handle.evaluate(async ({ worker }, subscription): Promise<BrowserSubscriptionValue> =>
        new Promise((resolveSubscription, reject) => {
          const cleanup = (): void => {
            clearTimeout(timeout);
            worker.removeEventListener('message', handleMessage);
          };
          const handleMessage = (event: MessageEvent): void => {
            const message: unknown = event.data;
            if (typeof message !== 'object' || message === null || !('subscriptionId' in message)
              || message.subscriptionId !== subscription.subscriptionId || !('type' in message)) {
              return;
            }
            if (message.type === 'subscribed' && 'epoch' in message && typeof message.epoch === 'string') {
              cleanup();
              resolveSubscription({ epoch: message.epoch, kind: 'subscribed' });
            }
            else if (message.type === 'subscription_denied' && 'detail' in message && message.detail instanceof ArrayBuffer) {
              cleanup();
              resolveSubscription({ detail: Array.from(new Uint8Array(message.detail)), kind: 'denied' });
            }
          };
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Production Worker subscription timed out'));
          }, 15_000);
          worker.addEventListener('message', handleMessage);
          worker.postMessage({
            channel: subscription.channel,
            headers: [
              ['x-demo-user-id', subscription.actingContext.userId],
              ['x-acting-organization-id', subscription.actingContext.organizationId],
            ],
            subscriptionId: subscription.subscriptionId,
            type: 'subscribe',
          });
        }), { actingContext, channel, subscriptionId });
      return result.kind === 'subscribed'
        ? { epoch: result.epoch, id: subscriptionId, kind: 'subscribed' }
        : { error: fromBinary(ErrorDetailSchema, Uint8Array.from(result.detail)), id: subscriptionId, kind: 'denied' };
    },
  };
};
