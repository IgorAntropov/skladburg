import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IEnginePort } from '../protocol/index';

import {
  createEngineCaller,
  createWarehouseRequest,
} from '../core/engine/testing/engineHarness';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import {
  ENGINE_BASE_URL,
  ENGINE_REQUEST_TIMEOUT_MS,
} from '../protocol/index';
import { connectToEngine } from './connectToEngine';
import {
  closeClientHarnesses,
  createClientHarness,
} from './testing/clientHarness';

const LIST_WAREHOUSES_URL = `${ENGINE_BASE_URL}/organization.v1.OrganizationService/ListWarehouses`;
const KEY_1 = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';

const customerOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

const waitForRequestCount = async (requestIds: () => readonly string[], count: number): Promise<void> => {
  await vi.waitFor(() => {
    expect(requestIds()).toHaveLength(count);
  });
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  closeClientHarnesses();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('connectToEngine fetch through the Connect transport', () => {
  it.each([true, false])('lists the warehouses of the acting organization (binary format: %s)', async (useBinaryFormat) => {
    const { createOrganizationClient, stub } = await createClientHarness();
    const expected = await createEngineCaller(stub.engine).organization.listWarehouses({}, customerOptions);

    const response = await createOrganizationClient(useBinaryFormat).listWarehouses({}, customerOptions);

    expect(response.warehouses).toHaveLength(3);
    expect(response.warehouses.map(warehouse => warehouse.id)).toEqual(expected.warehouses.map(warehouse => warehouse.id));
  });

  it('sends the request as a message with a transferred body and the headers as pairs', async () => {
    const { createOrganizationClient, stub } = await createClientHarness();

    await createOrganizationClient(true).listWarehouses({}, customerOptions);

    const request = stub.received.find(message => message.type === 'request');
    expect(request).toMatchObject({ method: 'POST', type: 'request', url: LIST_WAREHOUSES_URL });
    expect(request?.type === 'request' ? request.headers : []).toEqual(
      expect.arrayContaining([['x-demo-user-id', SeedUserId.ADMIN_1]]),
    );
  });

  it('delivers a permission error as a ConnectError with the error detail and its parameters', async () => {
    const { createOrganizationClient } = await createClientHarness();

    const error = await captureError(createOrganizationClient(true).createWarehouse(
      createWarehouseRequest(KEY_1),
      callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    ));

    const detail = readErrorDetail(error);
    expect(error).toBeInstanceOf(ConnectError);
    expect(error.code).toBe(Code.PermissionDenied);
    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(detail.params.case === 'permissionDenied' ? detail.params.value.permission : undefined).toBe('warehouse_create');
  });

  it('answers membership_required to a user who acts for a foreign organization', async () => {
    const { createOrganizationClient } = await createClientHarness();

    const error = await captureError(
      createOrganizationClient(false).listWarehouses({}, callAs(SeedUserId.ADMIN_1, SeedOrganizationId.SUPPLIER_1)),
    );

    expect(readErrorDetail(error).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('answers session_required without a user', async () => {
    const { createOrganizationClient } = await createClientHarness();

    const error = await captureError(createOrganizationClient(true).listWarehouses({}, callAs(undefined)));

    expect(error.code).toBe(Code.Unauthenticated);
    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });
});

describe('connectToEngine fetch cancellation', () => {
  it('sends abort, rejects the Connect call as canceled and ignores the late response', async () => {
    const { createOrganizationClient, stub } = await createClientHarness();
    const release = stub.holdResponses();
    const controller = new AbortController();

    const call = captureError(createOrganizationClient(true).listWarehouses({}, { ...customerOptions, signal: controller.signal }));
    await waitForRequestCount(stub.requestIds, 1);
    controller.abort();
    const error = await call;
    await vi.waitFor(() => {
      expect(stub.received.filter(message => message.type === 'abort')).toHaveLength(1);
    });
    release();
    await vi.waitFor(() => {
      expect(stub.sent.filter(message => message.type === 'response')).toHaveLength(1);
    });

    expect(error.code).toBe(Code.Canceled);
    expect(stub.received.filter(message => message.type === 'abort')).toEqual([{ requestId: stub.requestIds()[0], type: 'abort' }]);
    const next = await createOrganizationClient(true).listWarehouses({}, customerOptions);
    expect(next.warehouses).toHaveLength(3);
  });

  it('rejects with the reason of an already aborted signal and sends no request', async () => {
    const { connection, stub } = await createClientHarness();
    const reason = new Error('Navigated away');
    const controller = new AbortController();
    controller.abort(reason);

    await expect(connection.fetch(LIST_WAREHOUSES_URL, { method: 'POST', signal: controller.signal })).rejects.toBe(reason);
    await expect(connection.fetch(LIST_WAREHOUSES_URL, { method: 'POST' })).resolves.toBeInstanceOf(Response);

    expect(stub.received.filter(message => message.type === 'request')).toHaveLength(1);
    expect(stub.received.filter(message => message.type === 'abort')).toHaveLength(0);
  });

  it('rejects with the reason of the signal when it aborts while the request is pending', async () => {
    const { connection, stub } = await createClientHarness();
    stub.setMode('silent');
    const reason = new Error('Cancelled by the user');
    const controller = new AbortController();

    const pending = connection.fetch(LIST_WAREHOUSES_URL, { method: 'POST', signal: controller.signal });
    const outcome = expect(pending).rejects.toBe(reason);
    await waitForRequestCount(stub.requestIds, 1);
    controller.abort(reason);

    await outcome;
  });

  it('does not send the request when the signal aborts while the body is being read', async () => {
    const { connection, stub } = await createClientHarness();
    const controller = new AbortController();

    const pending = connection.fetch(LIST_WAREHOUSES_URL, { body: new Uint8Array([1]), method: 'POST', signal: controller.signal });
    const outcome = expect(pending).rejects.toBeInstanceOf(Error);
    controller.abort();

    await outcome;
    await connection.fetch(LIST_WAREHOUSES_URL, { method: 'POST' });
    expect(stub.received.filter(message => message.type === 'request')).toHaveLength(1);
  });
});

describe('connectToEngine fetch failures', () => {
  it('times out with unavailable, sends abort and ignores the late response', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { createOrganizationClient, stub } = await createClientHarness();
    stub.setMode('silent');

    const failure = captureError(createOrganizationClient(true).listWarehouses({}, customerOptions));
    await vi.advanceTimersByTimeAsync(ENGINE_REQUEST_TIMEOUT_MS);
    const error = await failure;
    stub.setMode('serve');
    stub.send({ body: new ArrayBuffer(0), headers: [], requestId: stub.requestIds()[0] ?? '', status: 200, type: 'response' });
    const next = await createOrganizationClient(true).listWarehouses({}, customerOptions);

    expect(error.code).toBe(Code.Unavailable);
    expect(error).toBeInstanceOf(ConnectError);
    expect(stub.received.filter(message => message.type === 'abort')).toEqual([{ requestId: stub.requestIds()[0], type: 'abort' }]);
    expect(next.warehouses).toHaveLength(3);
  });

  it('waits ten seconds by default', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const { createOrganizationClient } = await createClientHarness();

    await createOrganizationClient(true).listWarehouses({}, customerOptions);

    expect(ENGINE_REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);
  });

  it('clears the timer when the response arrives', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { createOrganizationClient } = await createClientHarness();

    await createOrganizationClient(true).listWarehouses({}, customerOptions);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out after the default period on fake timers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { connection, stub } = await createClientHarness();
    stub.setMode('silent');

    const outcome = expect(connection.fetch(LIST_WAREHOUSES_URL, { method: 'POST' })).rejects.toMatchObject({ code: Code.Unavailable });
    await vi.advanceTimersByTimeAsync(ENGINE_REQUEST_TIMEOUT_MS - 1);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);

    await outcome;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('turns transport_error into unavailable', async () => {
    const { createOrganizationClient, stub } = await createClientHarness();
    stub.setMode('transport_error');

    const error = await captureError(createOrganizationClient(true).listWarehouses({}, customerOptions));

    expect(error.code).toBe(Code.Unavailable);
  });

  it('rejects the pending requests with unavailable on close and refuses the next ones', async () => {
    const { connection, createOrganizationClient, stub } = await createClientHarness();
    stub.setMode('silent');

    const pending = captureError(createOrganizationClient(true).listWarehouses({}, customerOptions));
    await waitForRequestCount(stub.requestIds, 1);
    connection.close();
    const afterClose = await captureError(createOrganizationClient(true).listWarehouses({}, customerOptions));

    expect((await pending).code).toBe(Code.Unavailable);
    expect(afterClose.code).toBe(Code.Unavailable);
    expect(stub.received.filter(message => message.type === 'request')).toHaveLength(1);
  });

  it('rejects with unavailable and clears the timer when the port refuses the message', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const refusingPort: IEnginePort = {
      addEventListener: () => undefined,
      postMessage: () => {
        throw new Error('The message could not be cloned');
      },
      removeEventListener: () => undefined,
    };
    const connection = connectToEngine(refusingPort);

    await expect(connection.fetch(LIST_WAREHOUSES_URL, { method: 'POST' })).rejects.toMatchObject({ code: Code.Unavailable });

    expect(vi.getTimerCount()).toBe(0);
    expect(console.log).toHaveBeenCalledWith('> EngineConnection -> awaitReply:', expect.objectContaining({ requestId: 'request-1' }));
  });
});
