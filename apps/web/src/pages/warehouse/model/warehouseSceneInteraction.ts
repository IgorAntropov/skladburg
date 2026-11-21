import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type {
  WarehouseChargingStation,
  WarehouseEquipmentUnit,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import type { WarehouseStaffSummary } from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import type {
  ComponentType,
  RefObject,
} from 'react';
import type { BufferGeometry } from 'three';

import type { WarehouseInstancesProps } from '../scene/WarehouseInstances';
import type { WarehouseRackFootprintValue } from './warehouseRackGrid';
import type { WarehouseCargoValue } from './warehouseSceneCargo';
import type { WarehouseYardDragValue } from './warehouseYardDockChoice';
import type { WarehouseYardVehicleMarkingVisualValue } from './warehouseYardVehicleMarkingVisual';

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

export interface WarehouseSceneEquipmentValue {
  stations: readonly (Pick<WarehouseChargingStation, 'equipmentId' | 'id'> & { label: string })[];
  units: readonly (Pick<WarehouseEquipmentUnit, 'chargingStationId' | 'id' | 'status' | 'taskId'> & {
    badge: string;
    label: string;
    statusLabel: string;
  })[];
}

export interface WarehouseSceneInteractionValue {
  balances: readonly StockBalance[] | undefined;
  cargo: undefined | WarehouseCargoValue;
  construction: undefined | WarehouseConstructionPreviewValue;
  constructionLayer: ComponentType<WarehouseConstructionLayerProps>;
  equipment?: undefined | WarehouseSceneEquipmentValue;
  focusRequest: number;
  formatStaffOverflow?: ((count: number) => string) | undefined;
  isCameraReady?: boolean | undefined;
  isNight: boolean;
  isRefreshingYardFacts?: boolean | undefined;
  onCellSelect: (id: string) => void;
  onEquipmentSelect?: ((id: string, trigger?: HTMLElement) => void) | undefined;
  onStaffSelect?: ((staffId: string) => void) | undefined;
  parkingCapacity: number;
  scannedCell: undefined | WarehouseSceneScanValue;
  selectedCellId: string | undefined;
  selectedStaffId?: string | undefined;
  staffAreas?: readonly WarehouseSceneStaffAreaValue[] | undefined;
  staffOverlayHost?: RefObject<HTMLDivElement | null> | undefined;
  vehicleMarkings?: ReadonlyMap<string, WarehouseYardVehicleMarkingVisualValue> | undefined;
  yardDrag?: undefined | WarehouseYardDragValue;
}

export interface WarehouseSceneScanValue {
  cellId: string;
  focusId: string | undefined;
}

export interface WarehouseSceneStaffAreaValue {
  areaId: string;
  counter: undefined | WarehouseSceneStaffCounterValue;
  staff: readonly WarehouseSceneStaffPersonValue[];
}

export interface WarehouseSceneStaffCounterValue {
  comparison: 'balanced' | 'shortage' | 'surplus' | 'unknown';
  label: string;
  text: string;
}

export type WarehouseSceneStaffPersonValue = Pick<WarehouseStaffSummary, 'avatarKey' | 'displayName' | 'staffId' | 'workRole'>;
