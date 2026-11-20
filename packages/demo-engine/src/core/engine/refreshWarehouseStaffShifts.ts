import type { IModuleRuntime } from '../modules/moduleRuntime';

const MINUTE_MS = 60_000;

export const createWarehouseStaffShiftRefresh = (runtime: IModuleRuntime): (() => Promise<void>) => {
  let previousMinute = Math.floor(runtime.getWorldTimeMs() / MINUTE_MS);
  return async () => {
    const currentMinute = Math.floor(runtime.getWorldTimeMs() / MINUTE_MS);
    if (currentMinute !== previousMinute) {
      const { publishWarehouseShiftChanges } = await import('../modules/wms/warehouseStaffShifts');
      await publishWarehouseShiftChanges(runtime, previousMinute * MINUTE_MS, currentMinute * MINUTE_MS);
      previousMinute = currentMinute;
    }
  };
};
