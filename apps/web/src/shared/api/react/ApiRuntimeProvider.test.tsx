import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  GetOrganizationSettingsResponseSchema,
  OrganizationService,
  OrganizationSettingsSchema,
} from '@skladburg/contracts/organization/v1/organization';
import { ACTING_ORGANIZATION_HEADER } from '@skladburg/contracts/runtime';
import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ApiRuntimeValue } from '../runtime/apiRuntimeTypes';
import type { IDemoControl } from '../transport/demo';

import { ApiRuntimeProvider } from './ApiRuntimeProvider';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from './testing/createTestRuntime';
import { useActingContext } from './useActingContext';
import { useApiClient } from './useApiClient';
import { useDemoControl } from './useDemoControl';
import { useRealtimeChannel } from './useRealtimeChannel';

const createWrapper = (runtime: ApiRuntimeValue): (props: { children: ReactNode }) => ReactElement => {
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>{children}</ApiRuntimeProvider>
  );

  return Wrapper;
};

const demoControl: IDemoControl = {
  listPersonas: () => Promise.resolve([]),
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset: () => Promise.resolve(),
};

describe('ApiRuntimeProvider hooks', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns the client from the runtime', () => {
    const runtime = createTestRuntime();

    const { result } = renderHook(useApiClient, { wrapper: createWrapper(runtime) });

    expect(result.current).toBe(runtime.client);
  });

  it('returns the realtime channel from the runtime', () => {
    const runtime = createTestRuntime();

    const { result } = renderHook(useRealtimeChannel, { wrapper: createWrapper(runtime) });

    expect(result.current).toBe(runtime.realtime);
  });

  it('returns the demo control from the runtime', () => {
    const runtime = createTestRuntime({ demoControl });

    const { result } = renderHook(useDemoControl, { wrapper: createWrapper(runtime) });

    expect(result.current).toBe(demoControl);
  });

  it('returns undefined demo control when the runtime has none', () => {
    const runtime = createTestRuntime();

    const { result } = renderHook(useDemoControl, { wrapper: createWrapper(runtime) });

    expect(result.current).toBeUndefined();
  });

  it('returns the current acting context', () => {
    const runtime = createTestRuntime();

    const { result } = renderHook(useActingContext, { wrapper: createWrapper(runtime) });

    expect(result.current).toEqual({ organizationId: TEST_ORGANIZATION_ID, userId: TEST_USER_ID });
  });

  it('rerenders when the acting context changes', () => {
    const runtime = createTestRuntime();
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount += 1;

      return useActingContext();
    }, { wrapper: createWrapper(runtime) });

    const initialRenderCount = renderCount;

    act(() => {
      runtime.actingContext.set({ organizationId: 'org-2', userId: 'user-2' });
    });

    expect(result.current).toEqual({ organizationId: 'org-2', userId: 'user-2' });
    expect(renderCount).toBeGreaterThan(initialRenderCount);
  });

  it('does not rerender when the acting context is set to the same value', () => {
    const runtime = createTestRuntime();
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount += 1;

      return useActingContext();
    }, { wrapper: createWrapper(runtime) });

    const initialRenderCount = renderCount;
    const initialContext = result.current;

    act(() => {
      runtime.actingContext.set({ organizationId: TEST_ORGANIZATION_ID, userId: TEST_USER_ID });
    });

    expect(renderCount).toBe(initialRenderCount);
    expect(result.current).toBe(initialContext);
  });

  it('unsubscribes from the acting context on unmount', () => {
    const runtime = createTestRuntime();
    const unsubscribe = vi.fn();
    const subscribe = vi.spyOn(runtime.actingContext, 'subscribe').mockReturnValue(unsubscribe);

    const { unmount } = renderHook(useActingContext, { wrapper: createWrapper(runtime) });

    expect(subscribe).toHaveBeenCalledTimes(1);

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('answers client calls with the routes of the test runtime', async () => {
    const runtime = createTestRuntime({
      routes: (router) => {
        router.service(OrganizationService, {
          getOrganizationSettings: () => create(GetOrganizationSettingsResponseSchema, {
            settings: create(OrganizationSettingsSchema, { brandName: 'Тестовая марка', organizationId: TEST_ORGANIZATION_ID }),
          }),
        });
      },
    });

    const response = await runtime.client.organization.getOrganizationSettings({});

    expect(response.settings?.brandName).toBe('Тестовая марка');
    expect(response.settings?.organizationId).toBe(TEST_ORGANIZATION_ID);
  });

  it('lets a route read the acting organization from the request header', async () => {
    const runtime = createTestRuntime({
      routes: (router) => {
        router.service(OrganizationService, {
          getOrganizationSettings: (_request, context) => create(GetOrganizationSettingsResponseSchema, {
            settings: create(OrganizationSettingsSchema, { organizationId: context.requestHeader.get(ACTING_ORGANIZATION_HEADER) ?? '' }),
          }),
        });
      },
    });

    const response = await runtime.client.organization.getOrganizationSettings({});

    expect(response.settings?.organizationId).toBe(TEST_ORGANIZATION_ID);
  });

  it('rejects calls to services without routes', async () => {
    const runtime = createTestRuntime();

    await expect(runtime.client.organization.getOrganizationSettings({})).rejects.toThrow();
  });

  it('uses the always network mode by default and accepts an override', () => {
    expect(createTestRuntime().networkMode).toBe('always');
    expect(createTestRuntime({ networkMode: 'online' }).networkMode).toBe('online');
  });

  const hooksByName: readonly (readonly [string, () => unknown])[] = [
    ['useApiClient', useApiClient],
    ['useActingContext', useActingContext],
    ['useDemoControl', useDemoControl],
    ['useRealtimeChannel', useRealtimeChannel],
  ];

  describe.each(hooksByName)('%s outside of the provider', (_name, hook) => {
    it('throws an error naming the provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(() => renderHook(hook)).toThrow('ApiRuntimeProvider');

      consoleError.mockRestore();
    });
  });
});
