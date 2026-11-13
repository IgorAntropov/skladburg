import type {
  EncodedPrintCodeValue,
  PrintCodeResponseValue,
  PrintCodeValue,
} from './printCodeTypes';

const ENCODER_TIMEOUT_MS = 30_000;

export const generatePrintCodes = (codes: readonly PrintCodeValue[], signal: AbortSignal): Promise<EncodedPrintCodeValue[]> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const worker = new Worker(new URL('./printCodes.worker.ts', import.meta.url), { type: 'module' });

    const close = (): void => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', handleAbort);
      worker.terminate();
    };
    const handleAbort = (): void => {
      close();
      reject(new DOMException('Print preparation cancelled', 'AbortError'));
    };
    const handleError = (): void => {
      close();
      reject(new Error('Print code generation failed'));
    };
    const handleMessage = (event: MessageEvent<PrintCodeResponseValue>): void => {
      if (event.data.kind !== 'ready' || event.data.codes.length !== codes.length) {
        handleError();
        return;
      }
      close();
      resolve(event.data.codes);
    };
    const timeout = setTimeout(handleError, ENCODER_TIMEOUT_MS);

    signal.addEventListener('abort', handleAbort, { once: true });
    worker.addEventListener('error', handleError);
    worker.addEventListener('messageerror', handleError);
    worker.addEventListener('message', handleMessage);
    try {
      worker.postMessage(codes);
    }
    catch {
      handleError();
    }
  });
