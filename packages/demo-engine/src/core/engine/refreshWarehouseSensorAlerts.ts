import type { IModuleRuntime } from '../modules/moduleRuntime';

import {
  WAREHOUSE_SENSOR_INTERVAL_MS,
  WAREHOUSE_SENSOR_SITE,
} from '../seed/warehouseSensorConfig';

export const createWarehouseSensorAlertRefresh = (runtime: IModuleRuntime, hasSensorSite: boolean): (() => Promise<void>) => {
  const startedAtMs = runtime.getWorldTimeMs();
  let previousSample: number | undefined;
  return async () => {
    const nowMs = runtime.getWorldTimeMs();
    const sample = Math.floor((nowMs - WAREHOUSE_SENSOR_SITE.installedAtMs) / WAREHOUSE_SENSOR_INTERVAL_MS);
    if (!hasSensorSite || sample < 0 || sample === previousSample) {
      return;
    }
    const { refreshWarehouseSensorAlerts } = await import('../modules/wms/warehouseSensorAlerts');
    await refreshWarehouseSensorAlerts(runtime, previousSample === undefined ? startedAtMs : nowMs);
    previousSample = sample;
  };
};
