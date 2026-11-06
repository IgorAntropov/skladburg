import {
  act,
  renderHook,
} from '@testing-library/react';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createCachedModuleLoader } from '@/shared/lib/module-loader';
import { useChunkLoader } from '@/shared/lib/module-loader';

import { useChunkLauncher } from './useChunkLauncher';

interface DeferredLoaderValue {
  loader: ReturnType<typeof createCachedModuleLoader<{ name: string }>>;
  rejectNext: (error: Error) => void;
  resolveNext: () => void;
}

const createDeferredLoader = (): DeferredLoaderValue => {
  const settlers: { reject: (error: Error) => void; resolve: () => void }[] = [];

  const loader = createCachedModuleLoader(() => new Promise<{ name: string }>((resolve, reject) => {
    settlers.push({
      reject,
      resolve: () => {
        resolve({ name: 'chunk' });
      },
    });
  }));

  return {
    loader,
    rejectNext: (error) => {
      settlers.shift()?.reject(error);
    },
    resolveNext: () => {
      settlers.shift()?.resolve();
    },
  };
};

describe('useChunkLoader', () => {
  it('stays idle until the chunk is asked for and then loads it once', async () => {
    const { loader, resolveNext } = createDeferredLoader();
    const { result } = renderHook(() => useChunkLoader(loader));

    expect(result.current.state).toEqual({ kind: 'idle' });

    act(() => {
      result.current.load();
    });

    expect(result.current.state).toEqual({ kind: 'loading' });

    await act(async () => {
      resolveNext();
      await loader();
    });

    expect(result.current.state).toEqual({ kind: 'loaded', module: { name: 'chunk' } });
  });

  it('starts as loaded when the chunk is already in memory', async () => {
    const { loader, resolveNext } = createDeferredLoader();
    const pending = loader();

    resolveNext();
    await pending;

    const { result } = renderHook(() => useChunkLoader(loader));

    expect(result.current.state).toEqual({ kind: 'loaded', module: { name: 'chunk' } });
  });

  it('reports a failure and loads again on retry', async () => {
    const { loader, rejectNext, resolveNext } = createDeferredLoader();
    const { result } = renderHook(() => useChunkLoader(loader));

    act(() => {
      result.current.load();
    });
    await act(async () => {
      rejectNext(new Error('offline'));
      await loader().catch(() => undefined);
    });

    expect(result.current.state).toEqual({ kind: 'failed', recovery: 'retry' });

    act(() => {
      result.current.load();
    });
    await act(async () => {
      resolveNext();
      await loader();
    });

    expect(result.current.state.kind).toBe('loaded');
  });

  it('ignores a chunk that arrives after the host is gone', async () => {
    const { loader, resolveNext } = createDeferredLoader();
    const { result, unmount } = renderHook(() => useChunkLoader(loader));

    act(() => {
      result.current.load();
    });
    unmount();

    await act(async () => {
      resolveNext();
      await loader();
    });

    expect(result.current.state).toEqual({ kind: 'loading' });
  });
});

describe('useChunkLauncher', () => {
  it('opens the chunk on demand, shows the loading state and then the module', async () => {
    const { loader, resolveNext } = createDeferredLoader();
    const { result } = renderHook(() => useChunkLauncher(loader));

    expect(result.current.module).toBeUndefined();
    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.open();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveNext();
      await loader();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.module).toEqual({ name: 'chunk' });
  });

  it('hides the module after closing and opens it at once the next time', async () => {
    const { loader, resolveNext } = createDeferredLoader();
    const { result } = renderHook(() => useChunkLauncher(loader));

    act(() => {
      result.current.open();
    });
    await act(async () => {
      resolveNext();
      await loader();
    });
    act(() => {
      result.current.close();
    });

    expect(result.current.module).toBeUndefined();

    act(() => {
      result.current.open();
    });

    expect(result.current.module).toEqual({ name: 'chunk' });
    expect(result.current.isLoading).toBe(false);
  });

  it('shows nothing when the chunk arrives after the panel was closed', async () => {
    const { loader, resolveNext } = createDeferredLoader();
    const { result } = renderHook(() => useChunkLauncher(loader));

    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.close();
    });
    await act(async () => {
      resolveNext();
      await loader();
    });

    expect(result.current.module).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps the failure for the notice and retries on the next open', async () => {
    const { loader, rejectNext, resolveNext } = createDeferredLoader();
    const { result } = renderHook(() => useChunkLauncher(loader));

    act(() => {
      result.current.open();
    });
    await act(async () => {
      rejectNext(new Error('offline'));
      await loader().catch(() => undefined);
    });

    expect(result.current.loadRecovery).toBe('retry');

    act(() => {
      result.current.open();
    });
    await act(async () => {
      resolveNext();
      await loader();
    });

    expect(result.current.loadRecovery).toBeUndefined();
    expect(result.current.module).toEqual({ name: 'chunk' });
  });
});
