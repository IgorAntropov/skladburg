import type { ConfigureWarehouseReceivingLayoutRequest } from '@skladburg/contracts/wms/v1/receiving_layout';
import type {
  WarehouseFloorRect,
  WarehouseReceivingArea,
  WarehouseTopology,
  WarehouseUnloadingPoint,
} from '@skladburg/contracts/wms/v1/topology';

import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';

import type { IDomainErrors } from '../../errors/index';
import type { WarehouseFloorRectangleValue } from './warehouseLayoutBounds';

import {
  containsWarehouseFloorRect,
  readWarehouseDockApproach,
} from './warehouseLayoutBounds';
import { WAREHOUSE_DOCK_MIN_SPACING_MM } from './warehouseTopologyRecords';

interface WarehouseDockPlacementValue {
  capabilities: WarehouseCapability[];
  current: undefined | WarehouseUnloadingPoint;
  fieldPath: string;
  isPreservingInheritedCapabilities: boolean;
  xMm: number;
}

interface WarehouseReceivingLayoutPlanValue {
  changedDockIds: ReadonlySet<string>;
  docks: WarehouseDockPlacementValue[];
  facadeZMm: number;
  footprint: WarehouseFloorRect;
  hasChangedFootprint: boolean;
  hasChangedGeometry: boolean;
  hasMovedPrimaryDock: boolean;
}

const LEGACY_LAYOUT_LIMIT_MM = 100_000;
const GRID_STEP_MM = 100;

const sameRectangle = (current: undefined | WarehouseFloorRect, next: WarehouseFloorRect): boolean =>
  current?.origin?.xMm === next.origin?.xMm && current?.origin?.zMm === next.origin?.zMm
  && current?.widthMm === next.widthMm && current.depthMm === next.depthMm;

const overlapsWarehouseFloorRect = (current: WarehouseFloorRectangleValue, next: WarehouseFloorRectangleValue): boolean => {
  const origin = current.origin;
  const other = next.origin;

  return origin !== undefined && other !== undefined
    && origin.xMm < other.xMm + next.widthMm && other.xMm < origin.xMm + current.widthMm
    && origin.zMm < other.zMm + next.depthMm && other.zMm < origin.zMm + current.depthMm;
};

const rejectField = (errors: IDomainErrors, fieldPath: string, rule: string): never => {
  throw errors.validationFailed([{ fieldPath, ruleId: `warehouse.${rule}` }]);
};

export const listReceivingLayoutDocks = (area: undefined | WarehouseReceivingArea): WarehouseUnloadingPoint[] =>
  area?.unloadingPoint === undefined ? [] : [area.unloadingPoint, ...area.additionalUnloadingPoints];

const readDockPlacements = (
  inputs: ConfigureWarehouseReceivingLayoutRequest['docks'],
  existing: readonly WarehouseUnloadingPoint[],
  warehouseCapabilities: readonly WarehouseCapability[],
  errors: IDomainErrors,
): WarehouseDockPlacementValue[] => {
  const byId = new Map(existing.map(dock => [dock.id, dock]));
  const updates = new Map<string, WarehouseDockPlacementValue>();
  const additions: WarehouseDockPlacementValue[] = [];

  for (const [index, input] of inputs.entries()) {
    const fieldPath = `docks[${String(index)}]`;
    const { capabilities, unloadingPointId, xMm } = input;
    if (xMm === undefined) {
      throw errors.validationFailed([{ fieldPath: `${fieldPath}.x_mm`, ruleId: 'required' }]);
    }
    const current = unloadingPointId === undefined ? undefined : byId.get(unloadingPointId);
    if (unloadingPointId !== undefined && current === undefined) {
      rejectField(errors, `${fieldPath}.unloading_point_id`, 'dock_unknown');
    }
    if (unloadingPointId !== undefined && updates.has(unloadingPointId)) {
      rejectField(errors, `${fieldPath}.unloading_point_id`, 'dock_duplicate');
    }

    const previousCapabilities = current?.capabilities ?? [];
    const isSameCapabilities = capabilities.length === previousCapabilities.length
      && capabilities.every(capability => previousCapabilities.includes(capability));
    if (capabilities.length > 0 && !isSameCapabilities && (!capabilities.includes(WarehouseCapability.RAMP)
      || capabilities.some(capability => capability !== WarehouseCapability.RAMP && !warehouseCapabilities.includes(capability)))) {
      rejectField(errors, `${fieldPath}.capabilities`, 'dock_capabilities');
    }
    const inheritsCapabilities = existing.length === 1 && inputs.length > 1 && previousCapabilities.length === 0;
    const savedCapabilities = current === undefined ? [WarehouseCapability.RAMP] : previousCapabilities;
    const defaults = current !== undefined && inheritsCapabilities ? warehouseCapabilities : savedCapabilities;
    const placement = {
      capabilities: [...(capabilities.length === 0 ? defaults : capabilities)],
      current,
      fieldPath,
      isPreservingInheritedCapabilities: capabilities.length === 0 && inheritsCapabilities,
      xMm,
    };
    if (unloadingPointId === undefined) {
      additions.push(placement);
    }
    else {
      updates.set(unloadingPointId, placement);
    }
  }

  const ordered = existing.map(({ id }) => updates.get(id) ?? rejectField(errors, 'docks', 'dock_missing'));
  return [...ordered, ...additions];
};

const readStorage = (topology: WarehouseTopology): WarehouseFloorRect[] => topology.storageZones.flatMap(({ bounds, rows }) => [
  ...(bounds === undefined ? [] : [bounds]),
  ...rows.flatMap(row => row.racks.flatMap(rack => rack.footprint === undefined ? [] : [rack.footprint])),
]);

const checkGeometry = (
  topology: WarehouseTopology,
  footprint: WarehouseFloorRect,
  facadeZMm: number,
  docks: readonly WarehouseDockPlacementValue[],
  hasChangedFootprint: boolean,
  errors: IDomainErrors,
): void => {
  const origin = footprint.origin;
  if (origin === undefined) {
    throw errors.validationFailed([{ fieldPath: 'receiving_footprint.origin', ruleId: 'required' }]);
  }
  const floor = topology.bounds ?? { depthMm: LEGACY_LAYOUT_LIMIT_MM, origin: { xMm: 0, zMm: 0 }, widthMm: LEGACY_LAYOUT_LIMIT_MM };
  const storage = readStorage(topology);
  if (hasChangedFootprint) {
    for (const [field, value] of [
      ['origin.x_mm', origin.xMm], ['origin.z_mm', origin.zMm], ['width_mm', footprint.widthMm], ['depth_mm', footprint.depthMm],
    ] as const) {
      if (value % GRID_STEP_MM !== 0) {
        rejectField(errors, `receiving_footprint.${field}`, 'receiving_grid_step');
      }
    }
    if (footprint.widthMm < 2_500 || footprint.depthMm < 1_900) {
      rejectField(errors, `receiving_footprint.${footprint.widthMm < 2_500 ? 'width_mm' : 'depth_mm'}`, 'receiving_min_size');
    }
    if (origin.zMm < facadeZMm || !containsWarehouseFloorRect(floor, footprint)) {
      rejectField(errors, 'receiving_footprint', 'receiving_outside_floor');
    }
    if (storage.some(rect => overlapsWarehouseFloorRect(rect, footprint))) {
      rejectField(errors, 'receiving_footprint', 'receiving_storage_overlap');
    }
  }
  const checked: WarehouseDockPlacementValue[] = [];
  for (const dock of docks) {
    const { current, fieldPath, xMm } = dock;
    const hasMoved = current?.position?.xMm !== xMm || current.position.zMm !== facadeZMm;
    if ((hasChangedFootprint || hasMoved) && (xMm < origin.xMm || xMm > origin.xMm + footprint.widthMm)) {
      rejectField(errors, `${fieldPath}.x_mm`, 'dock_outside_receiving');
    }
    if (checked.some(other => Math.abs(other.xMm - xMm) < WAREHOUSE_DOCK_MIN_SPACING_MM)) {
      rejectField(errors, `${fieldPath}.x_mm`, 'dock_spacing');
    }
    checked.push(dock);
    if (hasMoved) {
      if (xMm % GRID_STEP_MM !== 0) {
        rejectField(errors, `${fieldPath}.x_mm`, 'receiving_grid_step');
      }
      const approach: WarehouseFloorRectangleValue = readWarehouseDockApproach({ xMm, zMm: facadeZMm });
      if (!containsWarehouseFloorRect(floor, approach) || storage.some(rect => overlapsWarehouseFloorRect(rect, approach))) {
        rejectField(errors, `${fieldPath}.x_mm`, 'dock_approach_blocked');
      }
    }
  }
};

export const planWarehouseReceivingLayout = (
  topology: WarehouseTopology,
  request: ConfigureWarehouseReceivingLayoutRequest,
  warehouseCapabilities: readonly WarehouseCapability[],
  errors: IDomainErrors,
): WarehouseReceivingLayoutPlanValue => {
  const { receivingFootprint } = request;
  if (receivingFootprint === undefined) {
    throw errors.validationFailed([{ fieldPath: 'receiving_footprint', ruleId: 'required' }]);
  }
  const { receivingArea } = topology;
  const existing = listReceivingLayoutDocks(receivingArea);
  const docks = readDockPlacements(request.docks, existing, warehouseCapabilities, errors);
  const facadeZMm = receivingArea?.unloadingPoint?.position?.zMm ?? topology.bounds?.origin?.zMm ?? 0;
  const hasChangedFootprint = !sameRectangle(receivingArea?.footprint, receivingFootprint);
  checkGeometry(topology, receivingFootprint, facadeZMm, docks, hasChangedFootprint, errors);

  const changedDockIds = new Set<string>();
  let hasChangedGeometry = hasChangedFootprint;
  for (const { capabilities, current, isPreservingInheritedCapabilities, xMm } of docks) {
    const hasMoved = current?.position?.xMm !== xMm || current.position.zMm !== facadeZMm;
    hasChangedGeometry ||= hasMoved;
    if (current !== undefined && (hasMoved || (!isPreservingInheritedCapabilities && (capabilities.length !== current.capabilities.length
      || capabilities.some(capability => !current.capabilities.includes(capability)))))) {
      changedDockIds.add(current.id);
    }
  }
  return {
    changedDockIds,
    docks,
    facadeZMm,
    footprint: receivingFootprint,
    hasChangedFootprint,
    hasChangedGeometry,
    hasMovedPrimaryDock: existing[0]?.position?.xMm !== undefined && existing[0].position.xMm !== docks[0]?.xMm,
  };
};
