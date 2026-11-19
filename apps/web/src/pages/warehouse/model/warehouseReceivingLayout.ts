import type { MessageInitShape } from '@bufbuild/protobuf';
import type { ConfigureWarehouseReceivingLayoutRequestSchema } from '@skladburg/contracts/wms/v1/receiving_layout';
import type {
  WarehouseReceivingArea,
  WarehouseTopology,
  WarehouseUnloadingPoint,
} from '@skladburg/contracts/wms/v1/topology';

import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';

export interface ReceivingLayoutDefaultsValue {
  docks: readonly WarehouseUnloadingPoint[];
  values: ReceivingLayoutFormValue;
}

export interface ReceivingLayoutDockFormValue<T> {
  hasCold: boolean;
  hasOversize: boolean;
  xMm: T;
}

export interface ReceivingLayoutFormValue<T = string> {
  dockCount: number;
  docks: ReceivingLayoutDockFormValue<T>[];
  receivingFootprint: {
    depthMm: T;
    origin: { xMm: T; zMm: T };
    widthMm: T;
  };
}

type ReceivingLayoutGeometryValue = Pick<
  MessageInitShape<typeof ConfigureWarehouseReceivingLayoutRequestSchema>, 'docks' | 'receivingFootprint'
>;

export const readReceivingLayoutDocks = (area: undefined | WarehouseReceivingArea): WarehouseUnloadingPoint[] =>
  area?.unloadingPoint === undefined ? [] : [area.unloadingPoint, ...area.additionalUnloadingPoints];

export const readReceivingDockCapabilities = (
  dock: WarehouseUnloadingPoint,
  dockCount: number,
  warehouseCapabilities: readonly WarehouseCapability[],
): readonly WarehouseCapability[] =>
  dock.capabilities.length === 0 && dockCount === 1 ? warehouseCapabilities : dock.capabilities;

const DEFAULT_AREA_WIDTH_MM = 2_600;
const DEFAULT_AREA_DEPTH_MM = 1_900;

export const createReceivingLayoutDefaults = (
  topology: WarehouseTopology,
  warehouseCapabilities: readonly WarehouseCapability[],
  capacity = 6,
): ReceivingLayoutDefaultsValue => {
  const receiving = topology.receivingArea;
  const bounds = topology.bounds;
  const footprint = receiving?.footprint;
  const docks = readReceivingLayoutDocks(receiving);
  const defaultX = (bounds?.origin?.xMm ?? 0) + Math.max(0, (bounds?.widthMm ?? 0) - DEFAULT_AREA_WIDTH_MM);
  const x = footprint?.origin?.xMm ?? defaultX;
  const z = footprint?.origin?.zMm ?? bounds?.origin?.zMm ?? 0;
  const width = footprint?.widthMm ?? DEFAULT_AREA_WIDTH_MM;

  return {
    docks,
    values: {
      dockCount: Math.max(1, docks.length),
      docks: Array.from({ length: Math.max(capacity, docks.length) }, (_unused, index): ReceivingLayoutDockFormValue<string> => {
        const dock = docks[index];
        const capabilities = dock === undefined ? [] : readReceivingDockCapabilities(dock, docks.length, warehouseCapabilities);
        const xMm = dock?.position?.xMm ?? (index === 0 ? Math.round((x + width / 2) / 100) * 100 : 0);

        return {
          hasCold: capabilities.includes(WarehouseCapability.COLD),
          hasOversize: capabilities.includes(WarehouseCapability.OVERSIZE),
          xMm: String(xMm),
        };
      }),
      receivingFootprint: {
        depthMm: String(footprint?.depthMm ?? DEFAULT_AREA_DEPTH_MM), origin: { xMm: String(x), zMm: String(z) }, widthMm: String(width),
      },
    },
  };
};

export const createReceivingLayoutGeometry = (
  defaults: ReceivingLayoutDefaultsValue,
  values: ReceivingLayoutFormValue<number>,
): ReceivingLayoutGeometryValue => ({
  docks: values.docks.slice(0, values.dockCount).map(({ hasCold, hasOversize, xMm }, index) => {
    const dock = defaults.docks[index];
    const previous = defaults.values.docks[index];
    const hasChangedCapabilities = previous?.hasCold !== hasCold || previous.hasOversize !== hasOversize;
    const capabilities = dock === undefined || hasChangedCapabilities
      ? [WarehouseCapability.RAMP, ...(hasCold ? [WarehouseCapability.COLD] : []), ...(hasOversize ? [WarehouseCapability.OVERSIZE] : [])]
      : [];

    return dock === undefined ? { capabilities, xMm } : { capabilities, unloadingPointId: dock.id, xMm };
  }),
  receivingFootprint: values.receivingFootprint,
});
