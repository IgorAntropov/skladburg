import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import {
  createInProcessEngineConnection,
  DEMO_USER_HEADER,
  SeedOrganizationId,
  SeedPersonaId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  DemoEngineStatusValue,
  IEngineConnection,
} from '../transport/demo';

import { createApiRuntime } from './createApiRuntime';

const closers: (() => Promise<void>)[] = [];

const startInProcessEngine = (): ReturnType<typeof createInProcessEngineConnection> => {
  const inProcess = createInProcessEngineConnection();
  closers.push(() => inProcess.close());

  return inProcess;
};

const createUnavailableConnection = (): IEngineConnection => ({
  close: vi.fn(),
  control: {
    listPersonas: () => Promise.reject(new ConnectError('the engine is unavailable', Code.Unavailable)),
    onReset: () => () => undefined,
    reset: () => Promise.resolve(),
  },
  fetch: () => Promise.reject(new ConnectError('the engine is unavailable', Code.Unavailable)),
  onStatus: () => () => undefined,
  subscribe: () => () => undefined,
});

afterEach(async () => {
  for (const close of closers.splice(0)) {
    await close();
  }
});

describe('createApiRuntime with the demo engine', () => {
  it('chooses the default persona of the organization and calls the engine as that persona', async () => {
    const inProcess = startInProcessEngine();
    const requestHeaders: Headers[] = [];
    const connection: IEngineConnection = {
      ...inProcess.connection,
      fetch: (input, init) => {
        requestHeaders.push(new Headers(init?.headers));

        return inProcess.connection.fetch(input, init);
      },
    };

    const runtime = await createApiRuntime({ connection, defaultOrganizationId: SeedOrganizationId.CUSTOMER_1 });

    expect(runtime.networkMode).toBe('always');
    expect(runtime.actingContext.get()).toEqual({
      organizationId: SeedOrganizationId.CUSTOMER_1,
      userId: SeedUserId.ADMIN_1,
    });

    const response = await runtime.client.organization.listWarehouses({});

    expect(response.warehouses).toHaveLength(3);
    expect(requestHeaders.at(-1)?.get(ACTING_ORGANIZATION_HEADER)).toBe(SeedOrganizationId.CUSTOMER_1);
    expect(requestHeaders.at(-1)?.get(DEMO_USER_HEADER)).toBe(SeedUserId.ADMIN_1);

    runtime.close();
    await inProcess.close();

    expect(inProcess.pendingTimerCount()).toBe(0);
  });

  it('starts as the persona chosen by id and calls the engine as that persona', async () => {
    const inProcess = startInProcessEngine();

    const runtime = await createApiRuntime({
      connection: inProcess.connection,
      defaultOrganizationId: SeedOrganizationId.CUSTOMER_1,
      preferredPersonaId: SeedPersonaId.FRESH_STOREKEEPER,
    });

    expect(runtime.actingContext.get()).toEqual({
      organizationId: SeedOrganizationId.CUSTOMER_1,
      userId: SeedUserId.STOREKEEPER_1,
    });
    expect((await runtime.client.organization.listWarehouses({})).warehouses).toHaveLength(1);

    runtime.close();
  });

  it('exposes the engine control: personas and status', async () => {
    const inProcess = startInProcessEngine();
    const runtime = await createApiRuntime({
      connection: inProcess.connection,
      defaultOrganizationId: SeedOrganizationId.CUSTOMER_1,
    });
    const statuses: DemoEngineStatusValue[] = [];

    expect(runtime.demoControl).toBeDefined();
    expect((await runtime.demoControl?.listPersonas())?.length).toBeGreaterThan(0);

    const unsubscribe = runtime.demoControl?.onStatus(status => statuses.push(status));
    unsubscribe?.();

    expect(statuses.at(0)?.state).toBe('ready');

    runtime.close();
  });

  it('takes the passed connection over and closes it exactly once on close', async () => {
    const inProcess = startInProcessEngine();
    const closeSpy = vi.spyOn(inProcess.connection, 'close');
    const runtime = await createApiRuntime({
      connection: inProcess.connection,
      defaultOrganizationId: SeedOrganizationId.CUSTOMER_1,
    });

    expect(closeSpy).not.toHaveBeenCalled();

    runtime.close();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects at once when the engine is unavailable and closes the connection', async () => {
    const connection = createUnavailableConnection();

    await expect(createApiRuntime({ connection, defaultOrganizationId: SeedOrganizationId.CUSTOMER_1 })).rejects.toMatchObject({
      code: Code.Unavailable,
    });

    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it('rejects and closes the connection when the organization has no persona', async () => {
    const inProcess = startInProcessEngine();
    const closeSpy = vi.spyOn(inProcess.connection, 'close');

    await expect(
      createApiRuntime({ connection: inProcess.connection, defaultOrganizationId: '99999999-0000-4000-8000-000000000000' }),
    ).rejects.toThrow('no persona');

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
