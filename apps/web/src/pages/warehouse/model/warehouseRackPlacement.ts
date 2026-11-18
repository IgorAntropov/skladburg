import type { MessageInitShape } from '@bufbuild/protobuf';
import type {
  WarehouseCellInputSchema,
  WarehouseFloorPoint,
  WarehouseFloorRect,
  WarehouseRow,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

import { getWarehouseCells } from './warehouseCells';

export interface WarehouseRackPlacementValue {
  cells: readonly WarehouseRackCellInputValue[];
  expectedRevision: number;
  footprint: WarehouseRackFootprintValue;
  rackCode: string;
  rowId: string;
  warehouseId: string;
  zoneId: string;
}
type WarehouseRackCellInputValue = MessageInitShape<typeof WarehouseCellInputSchema> & { cellCode: string };
interface WarehouseRackCodesValue {
  cellPrefix: string;
  rackCode: string;
  rowCode: string;
  zoneCode: string;
}

type WarehouseRackFootprintValue = Pick<WarehouseFloorRect, 'depthMm' | 'widthMm'> & { origin: WarehouseRackPositionValue };

type WarehouseRackPositionValue = Pick<WarehouseFloorPoint, 'xMm' | 'zMm'>;

const GRID_STEP_MM = 100;
const RACK_GAP_MM = 500;
const RACK_DEPTH_MM = 1_000;
const CELL_WIDTH_MM = 600;
const CELL_OFFSETS_MM = [0, CELL_WIDTH_MM] as const;
const TIER_ELEVATIONS_MM = [0, 1_500] as const;
const RACK_WIDTH_MM = CELL_WIDTH_MM * CELL_OFFSETS_MM.length;
const MAX_COORDINATE_MM = 4_294_967_295;
const MAX_LAYOUT_REVISION = 4_294_967_295;
const MAX_ADDRESS_PART_LENGTH = 20;

const hasOrigin = (footprint: undefined | WarehouseFloorRect): footprint is WarehouseFloorRect & WarehouseRackFootprintValue =>
  footprint?.origin !== undefined;

const rightEdge = ({ origin, widthMm }: WarehouseRackFootprintValue): number => origin.xMm + widthMm;

const findRightmostRack = (row: WarehouseRow): undefined | WarehouseRackFootprintValue =>
  row.racks.map(rack => rack.footprint).filter(hasOrigin).reduce<undefined | WarehouseRackFootprintValue>(
    (current, next) => current === undefined || rightEdge(next) > rightEdge(current) ? next : current,
    undefined,
  );

const snapForward = (coordinateMm: number): number => Math.ceil(coordinateMm / GRID_STEP_MM) * GRID_STEP_MM;

const createFootprint = (topology: WarehouseTopology, row: WarehouseRow): undefined | WarehouseRackFootprintValue => {
  const rightmostRack = findRightmostRack(row);
  const zMm = Math.round((rightmostRack?.origin.zMm ?? 0) / GRID_STEP_MM) * GRID_STEP_MM;
  let xMm = rightmostRack === undefined ? 0 : snapForward(rightEdge(rightmostRack) + RACK_GAP_MM);
  const obstacles = [
    topology.receivingArea?.footprint,
    ...topology.storageZones.flatMap(zone => zone.rows.flatMap(entry => entry.racks.map(rack => rack.footprint))),
  ].filter(hasOrigin)
    .filter(({ depthMm, origin }) => origin.zMm < zMm + RACK_DEPTH_MM && zMm < origin.zMm + depthMm)
    .sort((current, prev) => current.origin.xMm - prev.origin.xMm);

  for (const obstacle of obstacles) {
    if (xMm + RACK_WIDTH_MM + RACK_GAP_MM <= obstacle.origin.xMm) {
      break;
    }

    xMm = Math.max(xMm, snapForward(rightEdge(obstacle) + RACK_GAP_MM));
  }

  if (xMm + RACK_WIDTH_MM > MAX_COORDINATE_MM || zMm + RACK_DEPTH_MM > MAX_COORDINATE_MM) {
    return undefined;
  }

  return { depthMm: RACK_DEPTH_MM, origin: { xMm, zMm }, widthMm: RACK_WIDTH_MM };
};

const normalizeCode = (code: string): string => code.normalize('NFC').trim();

const toAddressPart = (code: string, fallback: string): string =>
  code.toUpperCase().replace(/[^A-Z0-9]+/gu, '-').slice(0, MAX_ADDRESS_PART_LENGTH).replace(/^-|-$/gu, '') || fallback;

const numberedCode = (prefix: string, position: number): string => `${prefix}${String(position + 1).padStart(2, '0')}`;

const createCells = (
  { cellPrefix, rackCode, rowCode, zoneCode }: WarehouseRackCodesValue,
  footprint: WarehouseRackFootprintValue,
): WarehouseRackCellInputValue[] => TIER_ELEVATIONS_MM.flatMap((tierElevationMm, tierIndex) => {
  const tierCode = numberedCode('Y', tierIndex);

  return CELL_OFFSETS_MM.map((xOffsetMm, cellIndex) => ({
    cellCode: `${cellPrefix}-${rackCode}-${tierCode}-${numberedCode('C', cellIndex)}`,
    rackCode,
    rackFootprint: footprint,
    rowCode,
    tierCode,
    tierElevationMm,
    widthMm: CELL_WIDTH_MM,
    xOffsetMm,
    zoneCode,
  }));
});

export const createWarehouseRackPlacement = (topology: WarehouseTopology, rowId: string): undefined | WarehouseRackPlacementValue => {
  const zone = topology.storageZones.find(entry => entry.rows.some(row => row.id === rowId));
  const row = zone?.rows.find(entry => entry.id === rowId);

  if (zone === undefined || row === undefined || topology.revision >= MAX_LAYOUT_REVISION) {
    return undefined;
  }

  const footprint = createFootprint(topology, row);
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
