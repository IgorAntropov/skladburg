import type {
  JSHandle,
  Page,
  Route,
} from '@playwright/test';

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
  readStartup: () => Promise<undefined | WorkerStartupValue>;
  reset: () => Promise<'control_result' | 'transport_error'>;
  stop: () => Promise<void>;
}

export type WorkerStartupValue
  = | { epoch: string; kind: 'ready'; storage: string }
    | { kind: 'unavailable' };

interface BrowserWorkerValue {
  messages: unknown[];
  worker: Worker;
}

type WorkerResultValue
  = | { body: number[]; status: number; type: 'response' }
    | { type: 'control_result' | 'transport_error' };

const findWorkerFileName = (): string => {
  const files = readdirSync(ASSET_DIRECTORY).filter(fileName =>
    /^worker-.*\.js$/u.test(fileName)
    && readFileSync(resolve(ASSET_DIRECTORY, fileName), 'utf8').includes('relay_to_leader'),
  );
  const [fileName] = files;

  if (files.length !== 1 || fileName === undefined) {
    throw new Error('Expected one production engine Worker');
  }

  return fileName;
};

export const createEngineWorkerRobot = async (page: Page): Promise<EngineWorkerRobotValue> => {
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
            resolveResponse({ body: Array.from(new Uint8Array(message.body)), status: message.status, type: 'response' });

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
                ['x-demo-user-id', '20000002-0000-4000-8000-000000000000'],
                ['x-acting-organization-id', '10000002-0000-4000-8000-000000000000'],
              ],
              method: 'POST',
              requestId,
              type: 'request',
              url: `https://demo-engine.invalid/${request.methodPath}`,
            });
      });
    }, { body: body === undefined ? undefined : Array.from(body), methodPath });

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
  };
};
