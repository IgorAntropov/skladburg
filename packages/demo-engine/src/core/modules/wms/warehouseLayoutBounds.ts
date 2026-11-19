import type { WarehouseFloorRect } from '@skladburg/contracts/wms/v1/topology';

export const containsWarehouseFloorRect = (bounds: undefined | WarehouseFloorRect, rect: undefined | WarehouseFloorRect): boolean => {
  const origin = rect?.origin;
  const outer = bounds?.origin;

  return bounds !== undefined && outer !== undefined && rect !== undefined && origin !== undefined
    && rect.widthMm > 0 && rect.depthMm > 0 && origin.xMm >= outer.xMm && origin.zMm >= outer.zMm
    && origin.xMm + rect.widthMm <= outer.xMm + bounds.widthMm && origin.zMm + rect.depthMm <= outer.zMm + bounds.depthMm;
};
