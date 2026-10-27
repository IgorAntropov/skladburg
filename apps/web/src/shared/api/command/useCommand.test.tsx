import type { RenderHookResult } from '@testing-library/react';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
  PermissionDeniedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import {
  QueryClientProvider,
  useIsMutating,
} from '@tanstack/react-query';
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

import type { ApiRuntimeValue } from '../runtime/apiRuntimeTypes';
import type {
  CommandOptionsValue,
  CommandValue,
} from './commandTypes';

import { createQueryClient } from '../query/createQueryClient';
import { ApiRuntimeContext } from '../react/ApiRuntimeContext';
import { createTestRuntime } from '../react/testing/createTestRuntime';
import { useCommand } from './useCommand';

type ExecuteValue = CommandOptionsValue<string>['execute'];

const createWrapper = (runtime?: ApiRuntimeValue) => {
  const queryClient = createQueryClient({ networkMode: 'always' });

  return ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeContext value={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeContext>
  );
};

const createDetailError = (code: ErrorCode, permission?: string): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{
    desc: ErrorDetailSchema,
    value: create(ErrorDetailSchema, {
      code,
      params: permission === undefined
        ? { case: undefined }
        : { case: 'permissionDenied', value: create(PermissionDeniedParamsSchema, { permission }) },
    }),
  }],
);

const createUnavailableError = (): ConnectError => createDetailError(ErrorCode.UNAVAILABLE);

const createPermissionDeniedError = (): ConnectError => createDetailError(ErrorCode.PERMISSION_DENIED, 'warehouse_create');

const renderCommand = (
  options: CommandOptionsValue<string>,
  runtime?: ApiRuntimeValue,
): RenderHookResult<CommandValue, CommandOptionsValue<string>> => renderHook(
  (props: CommandOptionsValue<string>) => useCommand(props),
  { initialProps: options, wrapper: createWrapper(runtime) },
);

describe('useCommand', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls execute once for two runs in the same tick', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve('done'));
    const { result } = renderCommand({ execute });

    act(() => {
      result.current.run();
      result.current.run();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('ignores a run while the command is pending', async () => {
    let resolveExecute: (value: string) => void = () => undefined;
    const execute = vi.fn<ExecuteValue>(() => new Promise<string>((resolve) => {
      resolveExecute = resolve;
    }));
    const { result } = renderCommand({ execute });

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    act(() => {
      result.current.run();
    });

    expect(execute).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveExecute('done');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });

  it('allows the next run after the command settles', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve('done'));
    const { result } = renderCommand({ execute });

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
      expect(result.current.isPending).toBe(false);
    });

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(2);
    });
  });

  it('retries with the same idempotency key after a retryable error', async () => {
    const execute = vi.fn<ExecuteValue>()
      .mockRejectedValueOnce(createUnavailableError())
      .mockResolvedValueOnce('done');
    const { result } = renderCommand({ execute });

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(result.current.apiError?.code).toBe(ErrorCode.UNAVAILABLE);
    });

    expect(result.current.apiError?.isRetryable).toBe(true);

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(2);
    });

    expect(execute.mock.calls[1]?.[0]).toBe(execute.mock.calls[0]?.[0]);
  });

  it('uses a new idempotency key after a success', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.resolve('done'));
    const { result } = renderCommand({ execute });

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
      expect(execute).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(2);
    });

    expect(execute.mock.calls[1]?.[0]).not.toBe(execute.mock.calls[0]?.[0]);
  });

  it('uses a new idempotency key after a non-retryable error', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.reject(createPermissionDeniedError()));
    const { result } = renderCommand({ execute });

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(result.current.apiError?.code).toBe(ErrorCode.PERMISSION_DENIED);
    });

    expect(result.current.apiError?.isRetryable).toBe(false);

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(2);
    });

    expect(execute.mock.calls[1]?.[0]).not.toBe(execute.mock.calls[0]?.[0]);
  });

  it('uses a new idempotency key after reset and clears the error', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.reject(createUnavailableError()));
    const { result } = renderCommand({ execute });

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(result.current.apiError).toBeDefined();
    });

    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.apiError).toBeUndefined();
    });

    expect(result.current.error).toBeNull();

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(2);
    });

    expect(execute.mock.calls[1]?.[0]).not.toBe(execute.mock.calls[0]?.[0]);
  });

  it('ignores a reset while the command is pending and keeps the result after the response', async () => {
    let resolveExecute: (value: string) => void = () => undefined;
    const onSuccess = vi.fn<(result: string) => void>();
    const execute = vi.fn<ExecuteValue>(() => new Promise<string>((resolve) => {
      resolveExecute = resolve;
    }));
    const { result } = renderCommand({ execute, onSuccess });

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isPending).toBe(true);

    act(() => {
      result.current.run();
    });

    expect(execute).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveExecute('done');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(2);
    });
  });

  it('shows the error of a command reset during the request and keeps the key for a retry', async () => {
    let rejectExecute: (error: Error) => void = () => undefined;
    const execute = vi.fn<ExecuteValue>()
      .mockImplementationOnce(() => new Promise<string>((_resolve, reject) => {
        rejectExecute = reject;
      }))
      .mockResolvedValueOnce('done');
    const { result } = renderCommand({ execute });

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    act(() => {
      result.current.reset();
    });

    await act(async () => {
      rejectExecute(createUnavailableError());
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.apiError?.code).toBe(ErrorCode.UNAVAILABLE);
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(2);
    });

    expect(execute.mock.calls[1]?.[0]).toBe(execute.mock.calls[0]?.[0]);
  });

  it('parses a connect error with a detail into the api error', async () => {
    const execute = vi.fn<ExecuteValue>(() => Promise.reject(createPermissionDeniedError()));
    const { result } = renderCommand({ execute });

    expect(result.current.apiError).toBeUndefined();

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(result.current.apiError?.code).toBe(ErrorCode.PERMISSION_DENIED);
    });

    expect(result.current.apiError?.params.case).toBe('permissionDenied');
    expect(result.current.failedAt).toBeGreaterThan(0);
  });

  it('calls onSuccess once with the result', async () => {
    const onSuccess = vi.fn<(result: string) => void>();
    const { result } = renderCommand({ execute: () => Promise.resolve('created'), onSuccess });

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    expect(onSuccess).toHaveBeenCalledWith('created');
  });

  it('makes a command without a method visible by its mutation key', async () => {
    let resolveExecute: (value: string) => void = () => undefined;
    const mutationKey = ['demo', 'reset'] as const;
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({
        command: useCommand({
          execute: () => new Promise<string>((resolve) => {
            resolveExecute = resolve;
          }),
          mutationKey,
        }),
        mutating: useIsMutating({ mutationKey }),
      }),
      { wrapper },
    );

    expect(result.current.command.method).toBeUndefined();
    expect(result.current.mutating).toBe(0);

    act(() => {
      result.current.command.run();
    });

    await waitFor(() => {
      expect(result.current.mutating).toBe(1);
    });

    await act(async () => {
      resolveExecute('done');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.mutating).toBe(0);
    });
  });

  it('derives the mutation key from the method', async () => {
    const method = OrganizationService.method.createWarehouse;
    let resolveExecute: (value: string) => void = () => undefined;
    const { result } = renderHook(
      () => ({
        command: useCommand({
          execute: () => new Promise<string>((resolve) => {
            resolveExecute = resolve;
          }),
          method,
        }),
        mutating: useIsMutating({ mutationKey: ['command', method.parent.typeName, method.name] }),
      }),
      { wrapper: createWrapper() },
    );

    expect(result.current.command.method).toBe(method);

    act(() => {
      result.current.command.run();
    });

    await waitFor(() => {
      expect(result.current.mutating).toBe(1);
    });

    await act(async () => {
      resolveExecute('done');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.mutating).toBe(0);
    });
  });

  it('writes a refusal to the error journal with the code, trace id and method', async () => {
    const runtime = createTestRuntime();
    const method = OrganizationService.method.createWarehouse;
    const error = new ConnectError(
      'failed',
      Code.FailedPrecondition,
      undefined,
      [{
        desc: ErrorDetailSchema,
        value: create(ErrorDetailSchema, { code: ErrorCode.UNAVAILABLE, traceId: 'trace-7' }),
      }],
    );
    const { result } = renderCommand({ execute: () => Promise.reject(error), method }, runtime);

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(runtime.errorJournal.list()).toHaveLength(1);
    });

    expect(runtime.errorJournal.list()[0]).toMatchObject({
      code: ErrorCode.UNAVAILABLE,
      method: `${method.parent.typeName}/${method.name}`,
      traceId: 'trace-7',
    });
  });

  it('writes the unknown method for a command without one', async () => {
    const runtime = createTestRuntime();
    const { result } = renderCommand({ execute: () => Promise.reject(createPermissionDeniedError()) }, runtime);

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(runtime.errorJournal.list()[0]?.method).toBe('unknown');
    });
  });

  it.each([
    ['a canceled connect call', () => new ConnectError('canceled', Code.Canceled)],
    ['an aborted request', () => new DOMException('aborted', 'AbortError')],
  ])('does not write %s to the error journal', async (_title, createError) => {
    const runtime = createTestRuntime();
    const { result } = renderCommand({ execute: () => Promise.reject(createError()) }, runtime);

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(runtime.errorJournal.list()).toHaveLength(0);
  });

  it('does not write a success to the error journal', async () => {
    const runtime = createTestRuntime();
    const { result } = renderCommand({ execute: () => Promise.resolve('done') }, runtime);

    act(() => {
      result.current.run();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(runtime.errorJournal.list()).toHaveLength(0);
  });
});
