import type {
  JSHandle,
  Page,
} from '@playwright/test';

import {
  readdirSync,
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const ASSET_DIRECTORY = resolve(import.meta.dirname, '../../dist/assets');

export interface ImportWorkerRobotValue {
  call: (method: string, body: Uint8Array) => Promise<Uint8Array>;
  hasLoadedXlsxReader: () => boolean;
  stop: () => Promise<void>;
}

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

export const createImportWorkerRobot = async (page: Page): Promise<ImportWorkerRobotValue> => {
  const requests: string[] = [];
  const handleRequest = (request: { url: () => string }): void => {
    requests.push(request.url());
  };
  page.on('request', handleRequest);
  await page.route('**/skladburg/', route => route.fulfill({ body: '<!doctype html><title>Worker</title>', contentType: 'text/html' }));
  await page.goto('./');
  const worker: JSHandle<Worker> = await page.evaluateHandle(fileName =>
    new Worker(new URL(`assets/${fileName}`, location.href), { type: 'module' }), findWorkerFileName());

  const call = async (method: string, body: Uint8Array): Promise<Uint8Array> => {
    const response = await worker.evaluate(async (engineWorker, request): Promise<number[]> => {
      const requestId = crypto.randomUUID();

      return new Promise((resolveResponse, reject) => {
        const cleanup = (): void => {
          clearTimeout(timeout);
          engineWorker.removeEventListener('message', handleMessage);
          engineWorker.removeEventListener('error', handleError);
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

          if (!('status' in message) || message.status !== 200 || !('body' in message) || !(message.body instanceof ArrayBuffer)) {
            reject(new Error(`Import Worker request failed: ${JSON.stringify(message)}`));

            return;
          }

          resolveResponse(Array.from(new Uint8Array(message.body)));
        };
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Import Worker request timed out'));
        }, 15_000);

        engineWorker.addEventListener('message', handleMessage);
        engineWorker.addEventListener('error', handleError);
        engineWorker.postMessage({
          body: Uint8Array.from(request.body).buffer,
          headers: [
            ['content-type', 'application/proto'],
            ['connect-protocol-version', '1'],
            ['x-demo-user-id', '20000002-0000-4000-8000-000000000000'],
            ['x-acting-organization-id', '10000002-0000-4000-8000-000000000000'],
          ],
          method: 'POST',
          requestId,
          type: 'request',
          url: `https://demo-engine.invalid/import.v1.ImportService/${request.method}`,
        });
      });
    }, { body: Array.from(body), method });

    return Uint8Array.from(response);
  };

  return {
    call,
    hasLoadedXlsxReader: () => requests.some(url => /\/xlsxReader-[^/]+\.js$/u.test(new URL(url).pathname)),
    stop: async () => {
      await worker.evaluate((engineWorker): void => {
        engineWorker.terminate();
      });
      await worker.dispose();
      page.off('request', handleRequest);
    },
  };
};
