import type {
  ReactElement,
  ReactNode,
} from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IDemoControl } from '@/shared/api';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';

import { useIsDemoResetAvailable } from './useIsDemoResetAvailable';
import { useResetDemoMutation } from './useResetDemoMutation';

const createDemoControl = (reset: IDemoControl['reset']): IDemoControl => ({
  listPersonas: () => Promise.resolve([]),
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset,
});

const renderWithRuntime = <Result extends boolean | object>(
  demoControl: IDemoControl | undefined,
  useHook: () => Result,
): { current: Result } => {
  const queryClient = createQueryClient({ networkMode: 'always' });
  const runtime = createTestRuntime({ demoControl });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  return renderHook(useHook, { wrapper: Wrapper }).result;
};

describe('useResetDemoMutation', () => {
  afterEach(() => {
    cleanup();
  });

  it('resets the demo once per call and does not retry a failure', async () => {
    const reset = vi.fn(() => Promise.reject(new Error('engine is busy')));
    const result = renderWithRuntime(createDemoControl(reset), useResetDemoMutation);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('fails without the demo control', async () => {
    const result = renderWithRuntime(undefined, useResetDemoMutation);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useIsDemoResetAvailable', () => {
  afterEach(() => {
    cleanup();
  });

  it('is available only when the runtime has the demo control', () => {
    const withControl = renderWithRuntime(createDemoControl(() => Promise.resolve()), useIsDemoResetAvailable);
    const withoutControl = renderWithRuntime(undefined, useIsDemoResetAvailable);

    expect(withControl.current).toBe(true);
    expect(withoutControl.current).toBe(false);
  });
});
