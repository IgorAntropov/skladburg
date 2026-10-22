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

interface TestModuleValue {
  name: string;
}

describe('useLoadedModule', () => {
  it('starts as loading and gives the module when it arrives', async () => {
    let resolve: (value: TestModuleValue) => void = () => undefined;
    const loader = createCachedModuleLoader(() => new Promise<TestModuleValue>((resolvePromise) => {
      resolve = resolvePromise;
    }));

    const { result } = renderHook(() => useLoadedModule(loader));

    expect(result.current.state).toEqual({ kind: 'loading' });

    resolve({ name: 'ready' });

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

  it('asks for a retry after the first failure, a reload after the second, and loads once the network is back', async () => {
    const source = vi.fn<() => Promise<TestModuleValue>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ name: 'back' });
    const loader = createCachedModuleLoader(source);

    const { result } = renderHook(() => useLoadedModule(loader));

    await waitFor(() => {
      expect(result.current.state).toEqual({ kind: 'failed', recovery: 'retry' });
    });

    act(() => {
      result.current.retry();
    });

    expect(result.current.isRetrying).toBe(true);

    await waitFor(() => {
      expect(result.current.state).toEqual({ kind: 'failed', recovery: 'reload' });
    });
    expect(result.current.isRetrying).toBe(false);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({ kind: 'loaded', module: { name: 'back' } });
    });
  });
});
