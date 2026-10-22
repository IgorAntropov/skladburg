import {
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

import { usePrewarmedModule } from './usePrewarmedModule';

describe('usePrewarmedModule', () => {
  it('starts the load once when the component mounts and keeps the module for later', async () => {
    const load = vi.fn(() => Promise.resolve({ name: 'ready' }));
    const loader = createCachedModuleLoader(load);

    const { rerender } = renderHook(() => {
      usePrewarmedModule(loader);
    });
    rerender();

    await waitFor(() => {
      expect(loader.peekLoadedModule()).toEqual({ name: 'ready' });
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('swallows a failed load and lets the next load try again', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ name: 'ready' });
    const loader = createCachedModuleLoader(load);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    renderHook(() => {
      usePrewarmedModule(loader);
    });

    await waitFor(() => {
      expect(logSpy).toHaveBeenCalled();
    });
    await expect(loader()).resolves.toEqual({ name: 'ready' });
    logSpy.mockRestore();
  });
});
