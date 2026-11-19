import type {
  WarehouseFloorPoint,
  WarehouseFloorRect,
} from '@skladburg/contracts/wms/v1/topology';

export interface WarehouseFloorRectangleValue extends Pick<WarehouseFloorRect, 'depthMm' | 'widthMm'> {
  origin?: undefined | WarehouseFloorPositionValue;
}

type WarehouseFloorPositionValue = Pick<WarehouseFloorPoint, 'xMm' | 'zMm'>;

const DOCK_APPROACH_HALF_WIDTH_MM = 1_250;
const DOCK_APPROACH_DEPTH_MM = 1_880;

export const readWarehouseDockApproach = ({ xMm, zMm }: WarehouseFloorPositionValue): WarehouseFloorRectangleValue => ({
  depthMm: DOCK_APPROACH_DEPTH_MM,
  origin: { xMm: xMm - DOCK_APPROACH_HALF_WIDTH_MM, zMm },
  widthMm: DOCK_APPROACH_HALF_WIDTH_MM * 2,
});

export const containsWarehouseFloorRect = (
  bounds: undefined | WarehouseFloorRectangleValue,
  rect: undefined | WarehouseFloorRectangleValue,
): boolean => {
  const origin = rect?.origin;
  const outer = bounds?.origin;

  return bounds !== undefined && outer !== undefined && rect !== undefined && origin !== undefined
    && rect.widthMm > 0 && rect.depthMm > 0 && origin.xMm >= outer.xMm && origin.zMm >= outer.zMm
    && origin.xMm + rect.widthMm <= outer.xMm + bounds.widthMm && origin.zMm + rect.depthMm <= outer.zMm + bounds.depthMm;
};
