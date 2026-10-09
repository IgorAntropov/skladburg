import { Code } from '@connectrpc/connect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { EngineStatusValue } from '../protocol/index';
import type { EngineConnectionStatusValue } from './types';

import { createWarehouseRequest } from '../core/engine/testing/engineHarness';
import { callAs } from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import {
  closeClientHarnesses,
  createClientHarness,
} from './testing/clientHarness';

const KEY_1 = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';

const customerOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

const LEADER_STATUS: EngineStatusValue = {
  coordination: 'single-tab',
  epoch: 'epoch-1',
  role: 'leader',
  storage: 'memory',
  storageHealth: 'failing',
};
const FOLLOWER_STATUS: EngineStatusValue = {
  coordination: 'shared',
  epoch: 'epoch-2',
  role: 'follower',
  storage: 'indexed-db',
  storageHealth: 'ok',
};

const LEADER_READY: EngineConnectionStatusValue = { ...LEADER_STATUS, state: 'ready' };
const FOLLOWER_READY: EngineConnectionStatusValue = { ...FOLLOWER_STATUS, state: 'ready' };
const UNAVAILABLE: EngineConnectionStatusValue = { reason: 'start_failed', state: 'unavailable' };

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  closeClientHarnesses();
  vi.restoreAllMocks();
});

describe('connectToEngine control', () => {
  it('lists the personas of the engine', async () => {
    const { connection, stub } = await createClientHarness();

    const personas = await connection.control.listPersonas();

    expect(personas.length).toBeGreaterThan(0);
    expect(personas).toEqual(stub.engine.listPersonas());
  });

  it('resets the demo, resolves after the engine confirms and notifies the reset listeners with the new epoch', async () => {
    const { connection, createOrganizationClient } = await createClientHarness();
    const epochs: string[] = [];
    connection.control.onReset((epoch) => {
      epochs.push(epoch);
    });
    await createOrganizationClient(true).createWarehouse(createWarehouseRequest(KEY_1), customerOptions);

    await connection.control.reset();

    await vi.waitFor(() => {
      expect(epochs).toEqual(['reset-epoch-1']);
    });
    const response = await createOrganizationClient(true).listWarehouses({}, customerOptions);
    expect(response.warehouses).toHaveLength(3);
  });

  it('stops notifying a removed reset listener', async () => {
    const { connection, stub } = await createClientHarness();
    const removed = vi.fn();
    const kept = vi.fn();
    const unsubscribe = connection.control.onReset(removed);
    connection.control.onReset(kept);

    unsubscribe();
    stub.send({ epoch: 'epoch-9', type: 'reset_done' });

    await vi.waitFor(() => {
      expect(kept).toHaveBeenCalledWith('epoch-9');
    });
    expect(removed).not.toHaveBeenCalled();
  });

  it('turns a transport error and a timeout of a control command into unavailable', async () => {
    const { connection, stub } = await createClientHarness({ requestTimeoutMs: 30 });

    stub.setMode('transport_error');
    await expect(connection.control.listPersonas()).rejects.toMatchObject({ code: Code.Unavailable });
    stub.setMode('silent');
    await expect(connection.control.reset()).rejects.toMatchObject({ code: Code.Unavailable });
  });

  it('rejects a control command after close', async () => {
    const { connection } = await createClientHarness();

    connection.close();

    await expect(connection.control.listPersonas()).rejects.toMatchObject({ code: Code.Unavailable });
    await expect(connection.control.reset()).rejects.toMatchObject({ code: Code.Unavailable });
  });

  it('rejects the pending control command when the connection closes', async () => {
    const { connection, stub } = await createClientHarness();
    stub.setMode('silent');

    const pending = expect(connection.control.reset()).rejects.toMatchObject({ code: Code.Unavailable });
    await vi.waitFor(() => {
      expect(stub.received.filter(message => message.type === 'control')).toHaveLength(1);
    });
    connection.close();

    await pending;
  });
});

describe('connectToEngine status', () => {
  it('notifies the listeners of every status', async () => {
    const { connection, stub } = await createClientHarness();
    const statuses: EngineConnectionStatusValue[] = [];
    connection.onStatus((status) => {
      statuses.push(status);
    });

    stub.send({ ...LEADER_STATUS, type: 'status' });
    stub.send({ ...FOLLOWER_STATUS, type: 'status' });

    await vi.waitFor(() => {
      expect(statuses).toEqual([LEADER_READY, FOLLOWER_READY]);
    });
  });

  it('gives the last known status to a new listener at once and nothing when no status is known', async () => {
    const { connection, stub } = await createClientHarness();
    const early = vi.fn();
    connection.onStatus(early);
    expect(early).not.toHaveBeenCalled();

    stub.send({ ...LEADER_STATUS, type: 'status' });
    stub.send({ ...FOLLOWER_STATUS, type: 'status' });
    await vi.waitFor(() => {
      expect(early).toHaveBeenCalledTimes(2);
    });
    const late = vi.fn();
    connection.onStatus(late);

    expect(late).toHaveBeenCalledOnce();
    expect(late).toHaveBeenCalledWith(FOLLOWER_READY);
  });

  it('stops notifying a removed status listener', async () => {
    const { connection, stub } = await createClientHarness();
    const removed = vi.fn();
    const kept = vi.fn();
    const unsubscribe = connection.onStatus(removed);
    connection.onStatus(kept);

    unsubscribe();
    stub.send({ ...LEADER_STATUS, type: 'status' });

    await vi.waitFor(() => {
      expect(kept).toHaveBeenCalledWith(LEADER_READY);
    });
    expect(removed).not.toHaveBeenCalled();
  });

  it('reports the unavailable engine and then the ready one when a status follows', async () => {
    const { connection, stub } = await createClientHarness();
    const statuses: EngineConnectionStatusValue[] = [];
    connection.onStatus((status) => {
      statuses.push(status);
    });

    stub.send({ reason: 'start_failed', type: 'engine_unavailable' });
    stub.send({ ...FOLLOWER_STATUS, type: 'status' });

    await vi.waitFor(() => {
      expect(statuses).toEqual([UNAVAILABLE, FOLLOWER_READY]);
    });
  });

  it('gives the unavailable state to a new listener at once as the last known state', async () => {
    const { connection, stub } = await createClientHarness();
    const early = vi.fn();
    connection.onStatus(early);

    stub.send({ ...LEADER_STATUS, type: 'status' });
    stub.send({ reason: 'start_failed', type: 'engine_unavailable' });
    await vi.waitFor(() => {
      expect(early).toHaveBeenCalledTimes(2);
    });
    const late = vi.fn();
    connection.onStatus(late);

    expect(late).toHaveBeenCalledOnce();
    expect(late).toHaveBeenCalledWith(UNAVAILABLE);
  });

  it('ignores an engine_unavailable message with an unknown reason', async () => {
    const { connection, stub } = await createClientHarness();
    const listener = vi.fn();
    connection.onStatus(listener);

    stub.sendRaw({ reason: 'unknown', type: 'engine_unavailable' });
    stub.send({ ...LEADER_STATUS, type: 'status' });

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledOnce();
    });
    expect(listener).toHaveBeenCalledWith(LEADER_READY);
  });
});
