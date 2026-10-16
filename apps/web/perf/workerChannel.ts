import type { CDPSession } from '@playwright/test';

export interface IWorkerChannel {
  handleIncoming: (message: string) => void;
  onEvent: (handler: (method: string, params: unknown) => void) => void;
  send: (method: string, params?: object) => Promise<void>;
}

interface PendingCommandValue {
  reject: (error: Error) => void;
  resolve: () => void;
}

interface WorkerMessageEnvelopeValue {
  error?: { message: string };
  id?: number;
  method?: string;
  params?: unknown;
}

export const createWorkerChannel = (session: CDPSession, workerSessionId: string): IWorkerChannel => {
  const pendingById = new Map<number, PendingCommandValue>();
  const eventHandlers: ((method: string, params: unknown) => void)[] = [];
  let nextCommandId = 1;

  return {
    handleIncoming(message: string): void {
      const envelope = JSON.parse(message) as WorkerMessageEnvelopeValue;

      if (envelope.id === undefined) {
        for (const handler of eventHandlers) {
          handler(envelope.method ?? '', envelope.params);
        }

        return;
      }

      const pending = pendingById.get(envelope.id);

      pendingById.delete(envelope.id);

      if (envelope.error === undefined) {
        pending?.resolve();
      }
      else {
        pending?.reject(new Error(envelope.error.message));
      }
    },
    onEvent(handler: (method: string, params: unknown) => void): void {
      eventHandlers.push(handler);
    },
    async send(method: string, params: object = {}): Promise<void> {
      const id = nextCommandId;

      nextCommandId += 1;

      const reply = new Promise<void>((resolve, reject) => {
        pendingById.set(id, { reject, resolve });
      });

      await session.send('Target.sendMessageToTarget', {
        message: JSON.stringify({ id, method, params }),
        sessionId: workerSessionId,
      });
      await reply;
    },
  };
};
