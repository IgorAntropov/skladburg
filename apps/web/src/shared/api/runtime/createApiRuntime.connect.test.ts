import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import { DEMO_USER_HEADER } from '@skladburg/demo-engine/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createFetchSpy } from '../transport/testing/createFetchSpy';

const ORGANIZATION_ID = '10000001-0000-4000-8000-000000000000';
const API_URL = 'https://api.test';

const loadDemoModule = vi.fn();

const importCreateApiRuntime = async (): Promise<typeof import('./createApiRuntime')> => {
  vi.resetModules();
  vi.doMock('../transport/demo', () => {
    loadDemoModule();
    throw new Error('The demo engine must not be loaded in the connect branch');
  });

  return import('./createApiRuntime');
};

describe('createApiRuntime with the connect transport', () => {
  beforeEach(() => {
    loadDemoModule.mockClear();
    vi.stubEnv('VITE_API_TRANSPORT', 'connect');
  });

  afterEach(() => {
    vi.doUnmock('../transport/demo');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('builds the runtime without loading the demo engine', async () => {
    vi.stubEnv('VITE_API_URL', API_URL);
    const { createApiRuntime } = await importCreateApiRuntime();

    const runtime = await createApiRuntime({ defaultOrganizationId: ORGANIZATION_ID });

    expect(loadDemoModule).not.toHaveBeenCalled();
    expect(runtime.demoControl).toBeUndefined();
    expect(runtime.actingContext.get()).toEqual({ organizationId: ORGANIZATION_ID, userId: undefined });
    expect(() => {
      runtime.close();
    }).not.toThrow();
  });

  it('asks the query client to pause requests offline in the pilot runtime', async () => {
    vi.stubEnv('VITE_API_URL', API_URL);
    const { createApiRuntime } = await importCreateApiRuntime();

    const runtime = await createApiRuntime({ defaultOrganizationId: ORGANIZATION_ID });

    expect(runtime.networkMode).toBe('online');

    runtime.close();
  });

  it('gives a realtime channel without a source that stays silent and stops with the runtime', async () => {
    vi.stubEnv('VITE_API_URL', API_URL);
    const { createApiRuntime } = await importCreateApiRuntime();
    const scheduleFlush = vi.fn(() => () => undefined);
    const runtime = await createApiRuntime({
      defaultOrganizationId: ORGANIZATION_ID,
      frameScheduler: { schedule: scheduleFlush },
    });
    const listener = vi.fn();

    runtime.realtime.subscribe(`org:${ORGANIZATION_ID}`, listener);
    runtime.actingContext.set({ organizationId: ORGANIZATION_ID, userId: '20000001-0000-4000-8000-000000000000' });
    runtime.close();

    expect(listener).not.toHaveBeenCalled();
    expect(scheduleFlush).toHaveBeenCalledTimes(1);
  });

  it('calls the configured address with the organization header and no demo user', async () => {
    vi.stubEnv('VITE_API_URL', API_URL);
    const spy = createFetchSpy();
    vi.stubGlobal('fetch', spy.fetch);
    const { createApiRuntime } = await importCreateApiRuntime();
    const runtime = await createApiRuntime({ defaultOrganizationId: ORGANIZATION_ID });

    await runtime.client.organization.listWarehouses({}).catch(() => undefined);

    expect(spy.requests).toHaveLength(1);
    expect(spy.requests.at(0)?.url.startsWith(API_URL)).toBe(true);
    expect(spy.requests.at(0)?.headers.get(ACTING_ORGANIZATION_HEADER)).toBe(ORGANIZATION_ID);
    expect(spy.requests.at(0)?.headers.get(DEMO_USER_HEADER)).toBeNull();
  });

  it('refuses to start without VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const { createApiRuntime } = await importCreateApiRuntime();

    await expect(createApiRuntime({ defaultOrganizationId: ORGANIZATION_ID })).rejects.toThrow('VITE_API_URL');
    expect(loadDemoModule).not.toHaveBeenCalled();
  });
});
