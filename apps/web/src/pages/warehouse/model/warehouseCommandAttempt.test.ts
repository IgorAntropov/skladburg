import {
  expect,
  it,
  vi,
} from 'vitest';

import { createWarehouseCommandAttempt } from './warehouseCommandAttempt';

it('keeps the first command payload when a refreshed task version arrives between retries', async () => {
  const attempt = createWarehouseCommandAttempt<number>();
  const oldVersion = vi.fn<() => Promise<number>>()
    .mockRejectedValueOnce(new Error('Transient failure'))
    .mockResolvedValue(1);
  const newVersion = vi.fn((): Promise<number> => Promise.resolve(2));

  await expect(attempt('first-key', oldVersion)).rejects.toThrow('Transient failure');
  await expect(attempt('first-key', newVersion)).resolves.toBe(1);
  expect(oldVersion).toHaveBeenCalledTimes(2);
  expect(newVersion).not.toHaveBeenCalled();

  await expect(attempt('second-key', newVersion)).resolves.toBe(2);
});
