import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  EngineClientMessageValue,
  EngineHostMessageValue,
  IEnginePort,
} from '../protocol/index';
import type { IEngineConnection } from './types';

import {
  ENGINE_BASE_URL,
  parseEngineClientMessage,
} from '../protocol/index';
import { connectToEngine } from './connectToEngine';

const LIST_WAREHOUSES_URL = `${ENGINE_BASE_URL}/organization.v1.OrganizationService/ListWarehouses`;

const UNAVAILABLE_MESSAGE: EngineHostMessageValue = { reason: 'start_failed', type: 'engine_unavailable' };
const READY_MESSAGE: EngineHostMessageValue = {
  coordination: 'shared',
  epoch: 'epoch-1',
  role: 'leader',
  storage: 'indexed-db',
  storageHealth: 'ok',
  type: 'status',
};

interface FakePortValue {
  connection: IEngineConnection;
  emit: (message: EngineHostMessageValue) => void;
  posted: () => EngineClientMessageValue[];
  rejectAbort: () => void;
}

const createFakePort = (requestTimeoutMs?: number): FakePortValue => {
  const listeners = new Set<(event: MessageEvent) => void>();
  const messages: unknown[] = [];
  let isAbortRejected = false;

  const port: IEnginePort = {
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    postMessage: (message) => {
      if (isAbortRejected && parseEngineClientMessage(message)?.type === 'abort') {
        throw new Error('The port is broken');
      }

      messages.push(message);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };

  const connection = connectToEngine(port, requestTimeoutMs === undefined ? {} : { requestTimeoutMs });

  return {
    connection,
    emit: (message) => {
      for (const listener of [...listeners]) {
        listener(new MessageEvent('message', { data: message }));
      }
    },
    posted: () => messages.flatMap((message) => {
      const parsed = parseEngineClientMessage(message);

      return parsed === undefined ? [] : [parsed];
    }),
    rejectAbort: () => {
      isAbortRejected = true;
    },
  };
};

const readRequestIds = (messages: readonly EngineClientMessageValue[], type: 'control' | 'request'): string[] =>
  messages.flatMap(message => message.type === type ? [message.requestId] : []);

const readAbortedIds = (messages: readonly EngineClientMessageValue[]): string[] =>
  messages.flatMap(message => message.type === 'abort' ? [message.requestId] : []);

const startFetch = (connection: IEngineConnection, signal?: AbortSignal): Promise<Response> =>
  connection.fetch(LIST_WAREHOUSES_URL, signal === undefined ? { method: 'POST' } : { method: 'POST', signal });

const toRejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  }
  catch (error) {
    return error;
  }

  return undefined;
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('connectToEngine fast refusal while the engine is unavailable', () => {
  it('rejects fetch, listPersonas and reset at once with Unavailable and posts nothing to the port', async () => {
    const { connection, emit, posted } = createFakePort();
    emit(UNAVAILABLE_MESSAGE);

    const fetchError = await toRejection(startFetch(connection));
    const listError = await toRejection(connection.control.listPersonas());
    const resetError = await toRejection(connection.control.reset());

    for (const error of [fetchError, listError, resetError]) {
      expect(error).toBeInstanceOf(ConnectError);
      expect(error).toMatchObject({ code: Code.Unavailable });
      expect(error instanceof ConnectError ? error.details : undefined).toEqual([]);
    }

    expect(posted()).toEqual([]);
  });

  it('rejects the calls made while the last status is unavailable even after a ready status before it', async () => {
    const { connection, emit, posted } = createFakePort();
    emit(READY_MESSAGE);
    emit(UNAVAILABLE_MESSAGE);

    await expect(connection.control.listPersonas()).rejects.toMatchObject({ code: Code.Unavailable });

    expect(posted()).toEqual([]);
  });

  it('cancels every pending call with an abort to the port when the engine becomes unavailable', async () => {
    const { connection, emit, posted } = createFakePort();
    const pendingFetch = toRejection(startFetch(connection));
    const pendingList = toRejection(connection.control.listPersonas());
    const pendingReset = toRejection(connection.control.reset());
    await vi.waitFor(() => {
      expect(posted()).toHaveLength(3);
    });
    const requestIds = [...readRequestIds(posted(), 'request'), ...readRequestIds(posted(), 'control')];

    emit(UNAVAILABLE_MESSAGE);

    for (const error of await Promise.all([pendingFetch, pendingList, pendingReset])) {
      expect(error).toMatchObject({ code: Code.Unavailable });
    }

    expect(requestIds).toHaveLength(3);
    expect(readAbortedIds(posted()).toSorted()).toEqual(requestIds.toSorted());
  });

  it('does not leave a pending call hanging when the abort cannot be posted on unavailable', async () => {
    const { connection, emit, posted, rejectAbort } = createFakePort();
    const pending = toRejection(connection.control.listPersonas());
    await vi.waitFor(() => {
      expect(posted()).toHaveLength(1);
    });
    rejectAbort();

    emit(UNAVAILABLE_MESSAGE);

    expect(await pending).toMatchObject({ code: Code.Unavailable });
    expect(console.log).toHaveBeenCalledWith('> EngineConnection -> sendAbort:', expect.objectContaining({ requestId: 'control-1' }));
  });

  it('works as usual after a ready status follows the unavailable one', async () => {
    const { connection, emit, posted } = createFakePort();
    emit(UNAVAILABLE_MESSAGE);
    await expect(connection.control.listPersonas()).rejects.toMatchObject({ code: Code.Unavailable });

    emit(READY_MESSAGE);
    const personas = connection.control.listPersonas();
    await vi.waitFor(() => {
      expect(posted()).toHaveLength(1);
    });
    const [requestId] = readRequestIds(posted(), 'control');
    emit({ personas: [], requestId: requestId ?? '', type: 'control_result' });

    expect(await personas).toEqual([]);
  });

  it('serves a fetch after a ready status follows the unavailable one', async () => {
    const { connection, emit, posted } = createFakePort();
    emit(UNAVAILABLE_MESSAGE);
    await expect(startFetch(connection)).rejects.toMatchObject({ code: Code.Unavailable });

    emit(READY_MESSAGE);
    const response = startFetch(connection);
    await vi.waitFor(() => {
      expect(posted()).toHaveLength(1);
    });
    const [requestId] = readRequestIds(posted(), 'request');
    emit({ body: new ArrayBuffer(0), headers: [], requestId: requestId ?? '', status: 200, type: 'response' });

    expect((await response).status).toBe(200);
  });

  it('keeps waiting for a reply while no status has arrived yet', async () => {
    const { connection, emit, posted } = createFakePort();

    const personas = connection.control.listPersonas();
    await vi.waitFor(() => {
      expect(posted()).toHaveLength(1);
    });
    const [requestId] = readRequestIds(posted(), 'control');
    emit({ personas: [], requestId: requestId ?? '', type: 'control_result' });

    expect(await personas).toEqual([]);
    expect(readAbortedIds(posted())).toEqual([]);
  });
});

describe('connectToEngine failures of the port and of the reply', () => {
  it('rejects an aborted fetch with the abort reason even when the abort message cannot be posted', async () => {
    const { connection, posted, rejectAbort } = createFakePort();
    const controller = new AbortController();
    const reason = new Error('Cancelled by the caller');
    const pending = toRejection(startFetch(connection, controller.signal));
    await vi.waitFor(() => {
      expect(posted()).toHaveLength(1);
    });
    rejectAbort();

    controller.abort(reason);

    expect(await pending).toBe(reason);
    expect(console.log).toHaveBeenCalledWith('> EngineConnection -> sendAbort:', expect.objectContaining({ requestId: 'request-1' }));
  });

  it('rejects a timed out call with Unavailable and clears the timer even when the abort message cannot be posted', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { connection, posted, rejectAbort } = createFakePort(30);
    const pending = toRejection(connection.control.listPersonas());
    expect(posted()).toHaveLength(1);
    rejectAbort();

    await vi.advanceTimersByTimeAsync(30);

    expect(await pending).toMatchObject({ code: Code.Unavailable });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('turns a reply that cannot be restored into Unavailable instead of Unknown', async () => {
    const { connection, emit, posted } = createFakePort();
    const pending = toRejection(startFetch(connection));
    await vi.waitFor(() => {
      expect(posted()).toHaveLength(1);
    });
    const [requestId] = readRequestIds(posted(), 'request');

    emit({ body: new ArrayBuffer(8), headers: [], requestId: requestId ?? '', status: 204, type: 'response' });

    const error = await pending;
    expect(error).toBeInstanceOf(ConnectError);
    expect(error).toMatchObject({ code: Code.Unavailable });
    expect(console.log).toHaveBeenCalledWith('> EngineConnection -> fetchFromEngine:', expect.objectContaining({ requestId }));
  });
});
