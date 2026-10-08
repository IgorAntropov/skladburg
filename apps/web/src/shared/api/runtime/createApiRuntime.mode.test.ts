import {
  createInProcessEngineConnection,
  SeedOrganizationId,
} from '@skladburg/demo-engine/testing';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createApiRuntime } from './createApiRuntime';

const closers: (() => Promise<void>)[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();

  for (const close of closers.splice(0)) {
    await close();
  }
});

describe('createApiRuntime transport choice', () => {
  const startDemoRuntime = async (): Promise<Awaited<ReturnType<typeof createApiRuntime>>> => {
    const inProcess = createInProcessEngineConnection();
    closers.push(() => inProcess.close());

    return createApiRuntime({
      connection: inProcess.connection,
      defaultOrganizationId: SeedOrganizationId.BUYER_1,
    });
  };

  it('uses the demo engine when the transport is not set', async () => {
    vi.stubEnv('VITE_API_TRANSPORT', undefined);

    const runtime = await startDemoRuntime();

    expect(runtime.demoControl).toBeDefined();

    runtime.close();
  });

  it('asks the query client to work offline in the demo runtime', async () => {
    vi.stubEnv('VITE_API_TRANSPORT', 'demo');

    const runtime = await startDemoRuntime();

    expect(runtime.networkMode).toBe('always');

    runtime.close();
  });

  it('uses the demo engine when it is chosen explicitly', async () => {
    vi.stubEnv('VITE_API_TRANSPORT', 'demo');

    const runtime = await startDemoRuntime();

    expect(runtime.demoControl).toBeDefined();

    runtime.close();
  });

  it('falls back to the demo engine for an unknown value', async () => {
    vi.stubEnv('VITE_API_TRANSPORT', 'grpc');

    const runtime = await startDemoRuntime();

    expect(runtime.demoControl).toBeDefined();

    runtime.close();
  });
});
