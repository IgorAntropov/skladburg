import type { IDemoEngine } from '../../core/engine/engineTypes';
import type {
  EngineClientMessageValue,
  EngineHostMessageValue,
  EngineRequestMessageValue,
} from '../../protocol/index';

import { createTestEngine } from '../../core/engine/testing/engineHarness';
import {
  encodeErrorDetail,
  encodeEvent,
  EngineControlCommand,
  parseEngineClientMessage,
  restoreRequest,
  serializeResponse,
} from '../../protocol/index';

export type EngineHostStubMode = 'serve' | 'silent' | 'transport_error';

export interface EngineHostStubValue {
  close: () => void;
  engine: IDemoEngine;
  holdResponses: () => (() => void);
  received: EngineClientMessageValue[];
  requestIds: () => string[];
  send: (message: EngineHostMessageValue, transfer?: Transferable[]) => void;
  sendRaw: (data: unknown) => void;
  sent: EngineHostMessageValue[];
  setMode: (mode: EngineHostStubMode) => void;
  subscriptionIds: () => string[];
}

export const createEngineHostStub = async (hostPort: MessagePort): Promise<EngineHostStubValue> => {
  const { engine } = await createTestEngine();
  const received: EngineClientMessageValue[] = [];
  const sent: EngineHostMessageValue[] = [];
  const unsubscribes = new Map<string, () => void>();
  let mode: EngineHostStubMode = 'serve';
  let gate: Promise<void> | undefined;
  let resetCounter = 0;

  const send = (message: EngineHostMessageValue, transfer: Transferable[] = []): void => {
    sent.push(message);
    hostPort.postMessage(message, transfer);
  };

  const holdResponses = (): (() => void) => {
    let release: () => void = () => undefined;
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    return () => {
      gate = undefined;
      release();
    };
  };

  const serveRequest = async (message: EngineRequestMessageValue): Promise<void> => {
    const response = await engine.handle(restoreRequest(message));
    const serialized = await serializeResponse(response, message.requestId);

    if (gate !== undefined) {
      await gate;
    }

    send(serialized.message, serialized.transfer);
  };

  const serveControl = async (requestId: string, command: EngineControlCommand): Promise<void> => {
    if (command === EngineControlCommand.LIST_PERSONAS) {
      send({ personas: [...engine.listPersonas()], requestId, type: 'control_result' });

      return;
    }

    resetCounter += 1;
    const epoch = `reset-epoch-${String(resetCounter)}`;
    await engine.reset(epoch);
    send({ requestId, type: 'control_result' });
    send({ epoch, type: 'reset_done' });
  };

  const serveSubscribe = (subscriptionId: string, channel: string, headers: Headers): void => {
    const result = engine.subscribe(channel, headers, (events) => {
      send({ events: events.map(encodeEvent), subscriptionId, type: 'events' });
    });

    if (result.kind === 'denied') {
      send({ detail: encodeErrorDetail(result.detail), subscriptionId, type: 'subscription_denied' });

      return;
    }

    unsubscribes.set(subscriptionId, result.unsubscribe);
    send({ epoch: result.epoch, seq: result.seq, subscriptionId, type: 'subscribed' });
  };

  const replyUnserved = (requestId: string): void => {
    if (mode === 'transport_error') {
      send({ requestId, type: 'transport_error' });
    }
  };

  const handleClientMessage = async (message: EngineClientMessageValue): Promise<void> => {
    switch (message.type) {
      case 'abort':
        break;
      case 'control':
        if (mode === 'serve') {
          await serveControl(message.requestId, message.command);
        }
        else {
          replyUnserved(message.requestId);
        }

        break;
      case 'request':
        if (mode === 'serve') {
          await serveRequest(message);
        }
        else {
          replyUnserved(message.requestId);
        }

        break;
      case 'subscribe':
        serveSubscribe(message.subscriptionId, message.channel, new Headers(message.headers));
        break;
      case 'unsubscribe':
        unsubscribes.get(message.subscriptionId)?.();
        unsubscribes.delete(message.subscriptionId);
        break;
    }
  };

  const handleMessage = (event: MessageEvent): void => {
    const message = parseEngineClientMessage(event.data);

    if (message === undefined) {
      return;
    }

    received.push(message);
    void handleClientMessage(message);
  };

  hostPort.addEventListener('message', handleMessage);
  hostPort.start();

  return {
    close: () => {
      hostPort.removeEventListener('message', handleMessage);

      for (const unsubscribe of unsubscribes.values()) {
        unsubscribe();
      }

      unsubscribes.clear();
      hostPort.close();
    },
    engine,
    holdResponses,
    received,
    requestIds: () => received.flatMap(message => message.type === 'request' ? [message.requestId] : []),
    send,
    sendRaw: (data) => {
      hostPort.postMessage(data, []);
    },
    sent,
    setMode: (nextMode) => {
      mode = nextMode;
    },
    subscriptionIds: () => received.flatMap(message => message.type === 'subscribe' ? [message.subscriptionId] : []),
  };
};
