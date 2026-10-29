import type { ReactNode } from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ApiRuntimeValue } from '@/shared/api';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import {
  ApiRuntimeProvider,
  useSwitchActingContext,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { useSupportContextCapture } from './useSupportContextCapture';

const stubStandaloneDisplayMode = (isStandalone: boolean): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: isStandalone && query === '(display-mode: standalone)' }));
};

const recordFailure = (runtime: ApiRuntimeValue, code: ErrorCode): void => {
  runtime.errorJournal.record({
    code,
    method: 'unknown',
    occurredAt: 1_700_000_000_000,
    params: { case: undefined },
    traceId: undefined,
  });
};

const setup = (path: string, seedCode?: ErrorCode): {
  location: IMemoryLocation;
  result: { current: ReturnType<typeof useSupportContextCapture> };
  runtime: ApiRuntimeValue;
} => {
  const runtime = createTestRuntime();
  const location = createMemoryLocation(path);

  if (seedCode !== undefined) {
    recordFailure(runtime, seedCode);
  }

  const { result } = renderHook(useSupportContextCapture, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ApiRuntimeProvider runtime={runtime}>
        <RoutingProvider location={location}>{children}</RoutingProvider>
      </ApiRuntimeProvider>
    ),
  });

  return { location, result, runtime };
};

describe('useSupportContextCapture', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('describes the current screen, version and device', () => {
    stubStandaloneDisplayMode(false);

    const { result } = setup('/network');
    const context = result.current();

    expect(context.screenPath).toBe('/network');
    expect(context.appVersion).toMatch(/^(dev|[0-9a-f]{7,40})$/);
    expect(context.device?.isInstalled).toBe(false);
    expect(context.errors).toEqual([]);
  });

  it('marks the installed application by the display mode', () => {
    stubStandaloneDisplayMode(true);

    const { result } = setup('/network');

    expect(result.current().device?.isInstalled).toBe(true);
  });

  it('keeps a captured context while the screen and the journal change, and captures the new state on demand', () => {
    stubStandaloneDisplayMode(false);

    const { location, result, runtime } = setup('/network');
    const first = result.current();

    act(() => {
      recordFailure(runtime, ErrorCode.UNAVAILABLE);
      location.navigate('/warehouse');
    });

    expect(first.screenPath).toBe('/network');
    expect(first.errors).toEqual([]);

    const second = result.current();

    expect(second).not.toBe(first);
    expect(second.screenPath).toBe('/warehouse');
    expect(second.errors).toHaveLength(1);
    expect(first.screenPath).toBe('/network');
  });

  it('does not carry an error of the previous context into the context captured after a switch', async () => {
    stubStandaloneDisplayMode(false);

    const runtime = createTestRuntime();
    const location = createMemoryLocation('/');
    const queryClient = new QueryClient();
    const { result } = renderHook(() => ({
      capture: useSupportContextCapture(),
      switcher: useSwitchActingContext(),
    }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ApiRuntimeProvider runtime={runtime}>
          <QueryClientProvider client={queryClient}>
            <RoutingProvider location={location}>{children}</RoutingProvider>
          </QueryClientProvider>
        </ApiRuntimeProvider>
      ),
    });

    recordFailure(runtime, ErrorCode.INTERNAL);

    expect(result.current.capture().errors).toHaveLength(1);

    await act(async () => {
      await result.current.switcher.switchActingContext({ organizationId: 'org-2', userId: 'user-2' });
    });

    expect(result.current.capture().errors).toEqual([]);
  });

  it('takes the errors that are in the journal at the moment of capture', () => {
    stubStandaloneDisplayMode(false);

    const { result } = setup('/', ErrorCode.INTERNAL);
    const context = result.current();

    expect(context.errors).toHaveLength(1);
    expect(context.errors[0]?.code).toBe(ErrorCode.INTERNAL);
    expect(context.screenPath).toBe('/');
  });
});
