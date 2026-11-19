import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { ComponentType } from 'react';
import type { BufferGeometry } from 'three';

import type { WarehouseInstancesProps } from '../scene/WarehouseInstances';
import type { WarehouseRackFootprintValue } from './warehouseRackGrid';
import type { WarehouseCargoValue } from './warehouseSceneCargo';

export type WarehouseConstructionChangeValue = (preview: undefined | WarehouseConstructionPreviewValue) => void;

export interface WarehouseConstructionLayerProps {
  construction: WarehouseConstructionPreviewValue;
  geometry: BufferGeometry;
  instances: ComponentType<WarehouseInstancesProps>;
  topology: WarehouseTopology;
}

export interface WarehouseConstructionPreviewValue {
  racks: readonly WarehouseConstructionRackValue[];
  selectedZoneId: string | undefined;
}

export interface WarehouseConstructionRackValue {
  baseRevision: number;
  footprint: WarehouseRackFootprintValue;
  isBlocked: boolean;
  zoneId: string;
}

export interface WarehouseSceneDataValue {
  parkingCapacity: number;
  topology: WarehouseTopology;
}

export interface WarehouseSceneInteractionValue {
  balances: readonly StockBalance[] | undefined;
  cargo: undefined | WarehouseCargoValue;
  construction: undefined | WarehouseConstructionPreviewValue;
  constructionLayer: ComponentType<WarehouseConstructionLayerProps>;
  focusRequest: number;
  onCellSelect: (id: string) => void;
  parkingCapacity: number;
  scannedCell: undefined | WarehouseSceneScanValue;
  selectedCellId: string | undefined;
}

export interface WarehouseSceneScanValue {
  cellId: string;
  focusId: string | undefined;
}
