import type { IModuleRuntime } from '../modules/moduleRuntime';

export const createWarehouseEquipmentRefresh = (runtime: IModuleRuntime, hasEquipment: boolean): (() => Promise<void>) => {
  let previousSecond: number | undefined;
  return async () => {
    const currentSecond = Math.floor(runtime.getWorldTimeMs() / 1_000);
    if (!hasEquipment || currentSecond === previousSecond) {
      return;
    }
    const { refreshWarehouseEquipment } = await import('../modules/wms/warehouseEquipmentOperations');
    await refreshWarehouseEquipment(runtime);
    previousSecond = currentSecond;
  };
};
