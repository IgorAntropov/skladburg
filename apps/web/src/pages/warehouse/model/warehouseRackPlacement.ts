import type { MessageInitShape } from '@bufbuild/protobuf';
import type {
  WarehouseCellInput,
  WarehouseCellInputSchema,
  WarehouseRow,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

import type {
  WarehouseRackFootprintValue,
  WarehouseRackPositionValue,
} from './warehouseRackGrid';

import { getWarehouseCells } from './warehouseCells';
import {
  getWarehouseRackObstacles,
  hasWarehouseRackOrigin,
  MAX_WAREHOUSE_COORDINATE_MM,
  WAREHOUSE_RACK_CELL_OFFSETS_MM,
  WAREHOUSE_RACK_CELL_WIDTH_MM,
  WAREHOUSE_RACK_DEPTH_MM,
  WAREHOUSE_RACK_GRID_STEP_MM,
  WAREHOUSE_RACK_WIDTH_MM,
  warehouseRackBottomEdgeMm,
  warehouseRackRightEdgeMm,
} from './warehouseRackGrid';
import { WAREHOUSE_RACK_TIER_ELEVATIONS_MM } from './warehouseRackTemplate';

export interface WarehouseRackPlacementValue {
  cells: readonly WarehouseRackCellInputValue[];
  expectedRevision: number;
  footprint: WarehouseRackFootprintValue;
  rackCode: string;
  rowId: string;
  warehouseId: string;
  zoneId: string;
}
type WarehouseRackCellInputValue = Exclude<MessageInitShape<typeof WarehouseCellInputSchema>, WarehouseCellInput> & { cellCode: string };
interface WarehouseRackCodesValue {
  cellPrefix: string;
  rackCode: string;
  rowCode: string;
  zoneCode: string;
}

const RACK_GAP_MM = 500;
const MAX_LAYOUT_REVISION = 4_294_967_295;
const MAX_ADDRESS_PART_LENGTH = 20;

const findRightmostRack = (row: WarehouseRow): undefined | WarehouseRackFootprintValue =>
  row.racks.map(rack => rack.footprint).filter(hasWarehouseRackOrigin).reduce<undefined | WarehouseRackFootprintValue>(
    (current, next) => current === undefined || warehouseRackRightEdgeMm(next) > warehouseRackRightEdgeMm(current) ? next : current,
    undefined,
  );

const snapForward = (coordinateMm: number): number => Math.ceil(coordinateMm / WAREHOUSE_RACK_GRID_STEP_MM) * WAREHOUSE_RACK_GRID_STEP_MM;

const suggestRackOrigin = (topology: WarehouseTopology, row: WarehouseRow): WarehouseRackPositionValue => {
  const rightmostRack = findRightmostRack(row);
  const zMm = Math.round((rightmostRack?.origin.zMm ?? 0) / WAREHOUSE_RACK_GRID_STEP_MM) * WAREHOUSE_RACK_GRID_STEP_MM;
  let xMm = rightmostRack === undefined ? 0 : snapForward(warehouseRackRightEdgeMm(rightmostRack) + RACK_GAP_MM);
  const obstacles = getWarehouseRackObstacles(topology)
    .map(({ footprint }) => footprint)
    .filter(({ depthMm, origin }) => origin.zMm < zMm + WAREHOUSE_RACK_DEPTH_MM && zMm < origin.zMm + depthMm)
    .sort((current, prev) => current.origin.xMm - prev.origin.xMm);

  for (const obstacle of obstacles) {
    if (xMm + WAREHOUSE_RACK_WIDTH_MM + RACK_GAP_MM <= obstacle.origin.xMm) {
      break;
    }

    xMm = Math.max(xMm, snapForward(warehouseRackRightEdgeMm(obstacle) + RACK_GAP_MM));
  }

  return { xMm, zMm };
};

const suggestBoundedRackOrigin = (topology: WarehouseTopology, bounds: WarehouseRackFootprintValue): WarehouseRackPositionValue => {
  const lastX = warehouseRackRightEdgeMm(bounds) - WAREHOUSE_RACK_WIDTH_MM;
  const lastZ = warehouseRackBottomEdgeMm(bounds) - WAREHOUSE_RACK_DEPTH_MM;
  const startX = snapForward(bounds.origin.xMm);
  const startZ = snapForward(bounds.origin.zMm);
  const obstacles = getWarehouseRackObstacles(topology)
    .map(({ footprint }) => footprint)
    .filter(obstacle => obstacle.origin.xMm < lastX + WAREHOUSE_RACK_WIDTH_MM && warehouseRackRightEdgeMm(obstacle) > startX
      && obstacle.origin.zMm < lastZ + WAREHOUSE_RACK_DEPTH_MM && warehouseRackBottomEdgeMm(obstacle) > startZ)
    .sort((current, prev) => current.origin.xMm - prev.origin.xMm);
  const depths = new Set([startZ, ...obstacles.map(obstacle => snapForward(warehouseRackBottomEdgeMm(obstacle)))]);

  for (const zMm of [...depths].filter(depth => depth <= lastZ).sort((current, prev) => current - prev)) {
    let xMm = startX;
    for (const obstacle of obstacles) {
      if (obstacle.origin.xMm >= xMm + WAREHOUSE_RACK_WIDTH_MM) {
        break;
      }
      const right = warehouseRackRightEdgeMm(obstacle);
      if (right > xMm && obstacle.origin.zMm < zMm + WAREHOUSE_RACK_DEPTH_MM && warehouseRackBottomEdgeMm(obstacle) > zMm) {
        xMm = snapForward(right);
      }
      if (xMm > lastX) {
        break;
      }
    }
    if (xMm <= lastX) {
      return { xMm, zMm };
    }
  }

  return { xMm: startX, zMm: startZ };
};

const isRackCoordinateAllowed = (coordinateMm: number, rackSizeMm: number): boolean =>
  coordinateMm >= 0 && coordinateMm % WAREHOUSE_RACK_GRID_STEP_MM === 0 && coordinateMm + rackSizeMm <= MAX_WAREHOUSE_COORDINATE_MM;

const createFootprint = (origin: WarehouseRackPositionValue): undefined | WarehouseRackFootprintValue => {
  if (!isRackCoordinateAllowed(origin.xMm, WAREHOUSE_RACK_WIDTH_MM) || !isRackCoordinateAllowed(origin.zMm, WAREHOUSE_RACK_DEPTH_MM)) {
    return undefined;
  }

  return { depthMm: WAREHOUSE_RACK_DEPTH_MM, origin, widthMm: WAREHOUSE_RACK_WIDTH_MM };
};

const normalizeCode = (code: string): string => code.normalize('NFC').trim();

const toAddressPart = (code: string, fallback: string): string =>
  code.toUpperCase().replace(/[^A-Z0-9]+/gu, '-').slice(0, MAX_ADDRESS_PART_LENGTH).replace(/^-|-$/gu, '') || fallback;

const numberedCode = (prefix: string, position: number): string => `${prefix}${String(position + 1).padStart(2, '0')}`;

const createCells = (
  { cellPrefix, rackCode, rowCode, zoneCode }: WarehouseRackCodesValue,
  footprint: WarehouseRackFootprintValue,
): WarehouseRackCellInputValue[] => WAREHOUSE_RACK_TIER_ELEVATIONS_MM.flatMap((tierElevationMm, tierIndex) => {
  const tierCode = numberedCode('Y', tierIndex);

  return WAREHOUSE_RACK_CELL_OFFSETS_MM.map((xOffsetMm, cellIndex) => ({
    cellCode: `${cellPrefix}-${rackCode}-${tierCode}-${numberedCode('C', cellIndex)}`,
    rackCode,
    rackFootprint: footprint,
    rowCode,
    tierCode,
    tierElevationMm,
    widthMm: WAREHOUSE_RACK_CELL_WIDTH_MM,
    xOffsetMm,
    zoneCode,
  }));
});

export const createWarehouseRackPlacement = (
  topology: WarehouseTopology,
  rowId: string,
  initialOrigin?: WarehouseRackPositionValue,
): undefined | WarehouseRackPlacementValue => {
  const zone = topology.storageZones.find(entry => entry.rows.some(row => row.id === rowId));
  const row = zone?.rows.find(entry => entry.id === rowId);

  if (zone === undefined || row === undefined || topology.revision >= MAX_LAYOUT_REVISION) {
    return undefined;
  }

  const bounds = zone.bounds;
  const footprint = createFootprint(initialOrigin ?? (hasWarehouseRackOrigin(bounds)
    ? suggestBoundedRackOrigin(topology, bounds)
    : suggestRackOrigin(topology, row)));
  if (footprint === undefined) {
    return undefined;
  }

  const zoneCode = normalizeCode(zone.code);
  const rowCode = normalizeCode(row.code);
  const cellPrefix = `${toAddressPart(zoneCode, 'Z')}-${toAddressPart(rowCode, 'R')}`;
  const occupiedRackCodes = new Set(row.racks.map(rack => normalizeCode(rack.code)));
  const occupiedCellCodes = new Set(getWarehouseCells(topology).map(cell => cell.code));

  for (let ordinal = 0; ordinal <= occupiedRackCodes.size + occupiedCellCodes.size; ordinal += 1) {
    const rackCode = numberedCode('S', ordinal);
    if (occupiedRackCodes.has(rackCode)) {
      continue;
    }

    const cells = createCells({ cellPrefix, rackCode, rowCode, zoneCode }, footprint);
    if (!cells.some(cell => occupiedCellCodes.has(cell.cellCode))) {
      return {
        cells,
        expectedRevision: topology.revision,
        footprint,
        rackCode,
        rowId,
        warehouseId: topology.warehouseId,
        zoneId: zone.id,
      };
    }
  }

  return undefined;
};

export const moveWarehouseRackPlacement = (
  draft: WarehouseRackPlacementValue,
  origin: WarehouseRackPositionValue,
): WarehouseRackPlacementValue => {
  const footprint = { ...draft.footprint, origin };

  return { ...draft, cells: draft.cells.map(cell => ({ ...cell, rackFootprint: footprint })), footprint };
};
