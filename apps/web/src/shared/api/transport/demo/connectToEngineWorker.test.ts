import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IEngineWorker } from './connectToEngineWorker';

import { connectToEngineWorker } from './connectToEngineWorker';
import { createEngineWorkerConnection } from './createEngineWorkerConnection';

const channels: MessageChannel[] = [];

const createFakeWorker = (callOrder: string[] = []): {
  terminate: ReturnType<typeof vi.fn<() => void>>;
  worker: IEngineWorker;
} => {
  const channel = new MessageChannel();
  channels.push(channel);

  const terminate = vi.fn<() => void>(() => {
    callOrder.push('terminate');
  });
  const postMessage = channel.port1.postMessage.bind(channel.port1);
  const worker: IEngineWorker = {
    addEventListener: (type, listener) => {
      channel.port1.addEventListener(type, listener);
    },
    postMessage: (message, transfer) => {
      callOrder.push(
        typeof message === 'object' && message !== null && 'type' in message ? String(message.type) : 'message',
      );
      postMessage(message, transfer);
    },
    removeEventListener: (type, listener) => {
      channel.port1.removeEventListener(type, listener);
    },
    start: () => {
      channel.port1.start();
    },
    terminate,
  };

  return { terminate, worker };
};

afterEach(() => {
  for (const channel of channels.splice(0)) {
    channel.port1.close();
    channel.port2.close();
  }
});

describe('connectToEngineWorker', () => {
  it('does not terminate the worker while the connection is open', () => {
    const { terminate, worker } = createFakeWorker();

    connectToEngineWorker(worker);

    expect(terminate).not.toHaveBeenCalled();
  });

  it('terminates the worker once on close, after the connection has said goodbye to the engine', () => {
    const callOrder: string[] = [];
    const { terminate, worker } = createFakeWorker(callOrder);
    const connection = connectToEngineWorker(worker);

    connection.subscribe('org:1', new Headers(), {
      onDenied: () => undefined,
      onEvents: () => undefined,
      onSubscribed: () => undefined,
    });
    callOrder.length = 0;

    connection.close();

    expect(terminate).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['unsubscribe', 'terminate']);
  });

  it('terminates the worker only once when closed twice', () => {
    const { terminate, worker } = createFakeWorker();
    const connection = connectToEngineWorker(worker);

    connection.close();
    connection.close();

    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('terminates the worker even when closing the connection fails', () => {
    const { terminate, worker } = createFakeWorker();
    const failingWorker: IEngineWorker = {
      ...worker,
      removeEventListener: () => {
        throw new Error('the port is broken');
      },
    };
    const connection = connectToEngineWorker(failingWorker);
    const closeConnection = (): void => {
      connection.close();
    };

    expect(closeConnection).toThrow('the port is broken');
    expect(terminate).toHaveBeenCalledTimes(1);

    expect(closeConnection).not.toThrow();
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});

describe('createEngineWorkerConnection', () => {
  it('connects to the worker made by the factory and terminates it on close', async () => {
    const { terminate, worker } = createFakeWorker();
    const createWorker = vi.fn<() => Promise<IEngineWorker>>(() => Promise.resolve(worker));

    const connection = await createEngineWorkerConnection(createWorker);

    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(terminate).not.toHaveBeenCalled();

    connection.close();

    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
