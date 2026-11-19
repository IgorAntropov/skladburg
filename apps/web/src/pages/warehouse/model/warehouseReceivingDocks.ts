import type {
  WarehouseReceivingArea,
  WarehouseUnloadingPoint,
} from '@skladburg/contracts/wms/v1/topology';

interface WarehouseReceivingDockValue {
  id: string;
  xMm: number;
  zMm: number;
}

const DOCK_MIN_SPACING_MM = 2660;

const readDock = (point: undefined | WarehouseUnloadingPoint): undefined | WarehouseReceivingDockValue => {
  const position = point?.position;
  if (point === undefined || position === undefined
    || !Number.isInteger(position.xMm) || position.xMm < 0 || !Number.isInteger(position.zMm) || position.zMm < 0) {
    return undefined;
  }
  return { id: point.id, xMm: position.xMm, zMm: position.zMm };
};

export const readWarehouseReceivingDocks = (area: undefined | WarehouseReceivingArea): readonly WarehouseReceivingDockValue[] => {
  const primary = readDock(area?.unloadingPoint);
  if (primary === undefined) {
    return [];
  }

  const docks = [primary];
  for (const candidate of area?.additionalUnloadingPoints ?? []) {
    const point = readDock(candidate);
    if (point?.zMm === primary.zMm && point.id !== ''
      && !docks.some(dock => dock.id === point.id || Math.abs(point.xMm - dock.xMm) < DOCK_MIN_SPACING_MM)) {
      docks.push(point);
    }
  }
  return docks;
};
