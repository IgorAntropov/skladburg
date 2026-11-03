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

import type { EditSnapshotValue } from './useEditBaseline';

import { useEditBaseline } from './useEditBaseline';

interface RecordValue {
  version: number;
}

describe('baseline of an edit form', () => {
  it('keeps the form while a saved record becomes the baseline', () => {
    const { result } = renderHook(() => useEditBaseline<RecordValue>({
      initial: { version: 1 },
      refetch: () => Promise.resolve(undefined),
    }));

    act(() => {
      result.current.accept({ version: 2 });
    });

    expect(result.current.baseline).toEqual({ version: 2 });
    expect(result.current.epoch).toBe(0);
  });

  it('takes the actual record on reload and asks for a new form', async () => {
    const onReloaded = vi.fn();
    const refetch = vi.fn((): Promise<EditSnapshotValue<RecordValue> | undefined> => Promise.resolve({ record: { version: 7 } }));
    const { result } = renderHook(() => useEditBaseline<RecordValue>({ initial: { version: 1 }, onReloaded, refetch }));

    act(() => {
      result.current.reload();
    });

    expect(result.current.isReloading).toBe(true);
    await waitFor(() => {
      expect(result.current.isReloading).toBe(false);
    });
    expect(result.current.baseline).toEqual({ version: 7 });
    expect(result.current.epoch).toBe(1);
    expect(onReloaded).toHaveBeenCalledTimes(1);
  });

  it('keeps the baseline and the form when the reload does not bring a record', async () => {
    const onReloaded = vi.fn();
    const { result } = renderHook(() => useEditBaseline<RecordValue>({
      initial: { version: 1 },
      onReloaded,
      refetch: () => Promise.resolve(undefined),
    }));

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.isReloading).toBe(false);
    });
    expect(result.current.baseline).toEqual({ version: 1 });
    expect(result.current.epoch).toBe(0);
    expect(onReloaded).not.toHaveBeenCalled();
  });
});
