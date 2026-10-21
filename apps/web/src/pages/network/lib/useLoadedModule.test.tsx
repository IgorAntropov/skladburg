import {
  act,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createCachedModuleLoader } from '@/shared/lib/module-loader';

import { useLoadedModule } from './useLoadedModule';

interface DeferredValue<TValue> {
  promise: Promise<TValue>;
  reject: (error: unknown) => void;
  resolve: (value: TValue) => void;
}

interface TestModuleValue {
  name: string;
}

function createDeferred<TValue>(): DeferredValue<TValue> {
  let resolve: (value: TValue) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<TValue>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

describe('useLoadedModule', () => {
  it('starts as loading and gives the module when it arrives', async () => {
    const deferred = createDeferred<TestModuleValue>();
    const loader = createCachedModuleLoader(() => deferred.promise);

    const { result } = renderHook(() => useLoadedModule(loader));

    expect(result.current.state).toEqual({ kind: 'loading' });

    deferred.resolve({ name: 'ready' });

    await waitFor(() => {
      expect(result.current.state).toEqual({ kind: 'loaded', module: { name: 'ready' } });
    });
  });

  it('starts loaded when the module is already in the cache', async () => {
    const loader = createCachedModuleLoader(() => Promise.resolve({ name: 'cached' }));
    await loader();

    const { result } = renderHook(() => useLoadedModule(loader));

    expect(result.current.state).toEqual({ kind: 'loaded', module: { name: 'cached' } });
  });

  it('asks for a retry after the first failure and for a reload after the second', async () => {
    const source = vi.fn<() => Promise<TestModuleValue>>(() => Promise.reject(new Error('offline')));
    const loader = createCachedModuleLoader(source);

    const { result } = renderHook(() => useLoadedModule(loader));

    await waitFor(() => {
      expect(result.current.state).toEqual({ kind: 'failed', recovery: 'retry' });
    });

    act(() => {
      result.current.retry();
    });

    expect(result.current.isRetrying).toBe(true);
    expect(result.current.state).toEqual({ kind: 'failed', recovery: 'retry' });

    await waitFor(() => {
      expect(result.current.state).toEqual({ kind: 'failed', recovery: 'reload' });
    });
    expect(result.current.isRetrying).toBe(false);
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('loads the module after a retry once the network is back', async () => {
    const source = vi.fn<() => Promise<TestModuleValue>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ name: 'back' });
    const loader = createCachedModuleLoader(source);

    const { result } = renderHook(() => useLoadedModule(loader));

    await waitFor(() => {
      expect(result.current.state.kind).toBe('failed');
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({ kind: 'loaded', module: { name: 'back' } });
    });
    expect(result.current.isRetrying).toBe(false);
  });

  it('ignores the answer that comes after the hook is unmounted', async () => {
    const deferred = createDeferred<TestModuleValue>();
    const loader = createCachedModuleLoader(() => deferred.promise);

    const { result, unmount } = renderHook(() => useLoadedModule(loader));

    unmount();
    deferred.resolve({ name: 'late' });
    await deferred.promise;

    expect(result.current.state).toEqual({ kind: 'loading' });
  });
});
