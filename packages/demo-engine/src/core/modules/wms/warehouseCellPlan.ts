import type {
  WarehouseCell,
  WarehouseCellInput,
  WarehouseFloorRect,
  WarehouseRack,
  WarehouseRow,
  WarehouseStorageZone,
  WarehouseTier,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import {
  WarehouseCellSchema,
  WarehouseRackSchema,
  WarehouseRowSchema,
  WarehouseStorageZoneSchema,
  WarehouseTierSchema,
  WarehouseTopologySchema,
} from '@skladburg/contracts/wms/v1/topology';

export interface WarehouseCellPlanValue {
  materialize: (warehouseId: string, tenantId: string, allocateId: () => string) => {
    addedCellIds: string[];
    topology: WarehouseTopology;
  };
  violations: WarehouseCellViolationValue[];
}

export interface WarehouseCellViolationValue {
  fieldPath: string;
  index: number;
  ruleId: string;
}

interface CellIntervalValue {
  end: number;
  index: number | undefined;
  start: number;
}

interface PendingCellValue {
  cell: WarehouseCellInput;
  index: number;
  isIntervalValid: boolean;
}

interface RackRectangleValue {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
  rack: RackValue | undefined;
}

interface RackValue {
  code: string;
  current: undefined | WarehouseRack;
  footprint: undefined | WarehouseFloorRect;
  tiers: Map<string, TierValue>;
}

type ReportViolation = (index: number, fieldPath: string, ruleId: string) => void;

interface RowValue {
  code: string;
  current: undefined | WarehouseRow;
  racks: Map<string, RackValue>;
}

interface TierValue {
  cells: PendingCellValue[];
  code: string;
  current: undefined | WarehouseTier;
  elevation: number | undefined;
}

interface ZoneValue {
  code: string;
  current: undefined | WarehouseStorageZone;
  rows: Map<string, RowValue>;
}

const MAX_UINT32 = 4_294_967_295;
const MAX_CELLS = 10_000;
const CELL_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

const normalizeCode = (value: string): string => value.normalize('NFC').trim();

export const normalizeWarehouseCellCodes = (cell: WarehouseCellInput): WarehouseCellInput => ({
  ...cell,
  cellCode: normalizeCode(cell.cellCode),
  rackCode: normalizeCode(cell.rackCode),
  rowCode: normalizeCode(cell.rowCode),
  tierCode: normalizeCode(cell.tierCode),
  zoneCode: normalizeCode(cell.zoneCode),
});

const checkCode = (code: string, index: number, path: string, limit: number, report: ReportViolation): boolean => {
  if (code === '') {
    report(index, path, path === 'cell_code' ? 'string.pattern' : 'string.min_len');

    return false;
  }

  if (Array.from(code).length > limit) {
    report(index, path, 'string.max_len');

    return false;
  }

  if (path === 'cell_code' && !CELL_CODE_PATTERN.test(code)) {
    report(index, path, 'string.pattern');

    return false;
  }

  return true;
};

const checkMillimeters = (value: number, minimum: number, index: number, path: string, report: ReportViolation): boolean => {
  if (!Number.isInteger(value) || value < minimum || value > MAX_UINT32) {
    report(index, path, minimum === 0 ? 'warehouse.invalid_millimeters' : 'warehouse.invalid_dimension');

    return false;
  }

  return true;
};

const checkFootprint = (footprint: WarehouseFloorRect, index: number, report: ReportViolation): boolean => {
  const hasWidth = checkMillimeters(footprint.widthMm, 1, index, 'rack_footprint.width_mm', report);
  const hasDepth = checkMillimeters(footprint.depthMm, 1, index, 'rack_footprint.depth_mm', report);

  if (footprint.origin === undefined) {
    report(index, 'rack_footprint.origin', 'required');

    return false;
  }

  const hasX = checkMillimeters(footprint.origin.xMm, 0, index, 'rack_footprint.origin.x_mm', report);
  const hasZ = checkMillimeters(footprint.origin.zMm, 0, index, 'rack_footprint.origin.z_mm', report);

  return hasWidth && hasDepth && hasX && hasZ;
};

const sameFootprint = (current: WarehouseFloorRect, prev: WarehouseFloorRect): boolean =>
  current.widthMm === prev.widthMm && current.depthMm === prev.depthMm
  && current.origin?.xMm === prev.origin?.xMm && current.origin?.zMm === prev.origin?.zMm;

const indexTopology = (current: undefined | WarehouseTopology, cellCodes: Set<string>): Map<string, ZoneValue> => new Map(
  current?.storageZones.map(zone => [normalizeCode(zone.code), {
    code: zone.code,
    current: zone,
    rows: new Map(zone.rows.map(row => [normalizeCode(row.code), {
      code: row.code,
      current: row,
      racks: new Map(row.racks.map(rack => [normalizeCode(rack.code), {
        code: rack.code,
        current: rack,
        footprint: rack.footprint,
        tiers: new Map(rack.tiers.map((tier) => {
          for (const cell of tier.cells) {
            cellCodes.add(cell.code);
          }

          return [normalizeCode(tier.code), { cells: [], code: tier.code, current: tier, elevation: tier.elevationMm }];
        })),
      }])),
    }])),
  }]),
);

const getOrAdd = <T>(map: Map<string, T>, code: string, createValue: () => T): T => {
  const existing = map.get(code);

  if (existing !== undefined) {
    return existing;
  }

  const value = createValue();
  map.set(code, value);

  return value;
};

const stageCell = (
  zones: Map<string, ZoneValue>,
  cellCodes: Set<string>,
  input: WarehouseCellInput,
  index: number,
  report: ReportViolation,
): void => {
  const cell = normalizeWarehouseCellCodes(input);
  const hasZone = checkCode(cell.zoneCode, index, 'zone_code', 32, report);
  const hasRow = checkCode(cell.rowCode, index, 'row_code', 32, report);
  const hasRack = checkCode(cell.rackCode, index, 'rack_code', 32, report);
  const hasTier = checkCode(cell.tierCode, index, 'tier_code', 32, report);
  const hasCell = checkCode(cell.cellCode, index, 'cell_code', 64, report);
  const hasOffset = checkMillimeters(cell.xOffsetMm, 0, index, 'x_offset_mm', report);
  const hasWidth = checkMillimeters(cell.widthMm, 1, index, 'width_mm', report);
  const footprint = cell.rackFootprint;
  const hasFootprint = footprint !== undefined && checkFootprint(footprint, index, report);
  const hasElevation = cell.tierElevationMm !== undefined && checkMillimeters(cell.tierElevationMm, 0, index, 'tier_elevation_mm', report);

  if (hasCell) {
    if (cellCodes.has(cell.cellCode)) {
      report(index, 'cell_code', 'warehouse.cell_code_duplicate');
    }

    cellCodes.add(cell.cellCode);
  }

  if (!hasZone || !hasRow || !hasRack || !hasTier) {
    return;
  }

  const zone = getOrAdd(zones, cell.zoneCode, () => ({ code: cell.zoneCode, current: undefined, rows: new Map() }));
  const row = getOrAdd(zone.rows, cell.rowCode, () => ({ code: cell.rowCode, current: undefined, racks: new Map() }));
  const rack = getOrAdd(row.racks, cell.rackCode, () => ({
    code: cell.rackCode,
    current: undefined,
    footprint: undefined,
    tiers: new Map(),
  }));
  const tier = getOrAdd(rack.tiers, cell.tierCode, () => ({ cells: [], code: cell.tierCode, current: undefined, elevation: undefined }));

  if (hasFootprint) {
    if (rack.footprint === undefined) {
      rack.footprint = footprint;
    }
    else if (!sameFootprint(rack.footprint, footprint)) {
      report(index, 'rack_footprint', 'warehouse.rack_geometry_conflict');
    }
  }

  if (hasElevation) {
    if (tier.elevation === undefined) {
      tier.elevation = cell.tierElevationMm;
    }
    else if (tier.elevation !== cell.tierElevationMm) {
      report(index, 'tier_elevation_mm', 'warehouse.tier_elevation_conflict');
    }
  }

  tier.cells.push({ cell, index, isIntervalValid: hasOffset && hasWidth });
};

const readCellInterval = (cell: Pick<WarehouseCell, 'widthMm' | 'xOffsetMm'>, index: number | undefined): CellIntervalValue => ({
  end: cell.xOffsetMm + cell.widthMm,
  index,
  start: cell.xOffsetMm,
});

const checkCellIntervals = (tier: TierValue, rackWidth: number, report: ReportViolation): void => {
  const intervals = tier.current?.cells.map(cell => readCellInterval(cell, undefined)) ?? [];

  for (const { cell, index, isIntervalValid } of tier.cells) {
    if (isIntervalValid) {
      const interval = readCellInterval(cell, index);

      if (interval.end > rackWidth) {
        report(index, 'x_offset_mm', 'warehouse.cell_outside_rack');
      }
      else {
        intervals.push(interval);
      }
    }
  }

  const overlapping = new Set<number>();
  let farthest: CellIntervalValue | undefined;

  for (const interval of intervals.sort((current, prev) => current.start - prev.start)) {
    if (farthest !== undefined && interval.start < farthest.end) {
      if (farthest.index !== undefined) {
        overlapping.add(farthest.index);
      }

      if (interval.index !== undefined) {
        overlapping.add(interval.index);
      }
    }

    if (farthest === undefined || interval.end > farthest.end) {
      farthest = interval;
    }
  }

  for (const index of overlapping) {
    report(index, 'x_offset_mm', 'warehouse.cell_overlap');
  }
};

const checkRackTiers = (rack: RackValue, report: ReportViolation): void => {
  const elevations = new Set(rack.current?.tiers.map(tier => tier.elevationMm));

  for (const tier of rack.tiers.values()) {
    if (tier.current === undefined && tier.elevation !== undefined) {
      if (elevations.has(tier.elevation)) {
        for (const { index } of tier.cells) {
          report(index, 'tier_elevation_mm', 'warehouse.tier_elevation_duplicate');
        }
      }

      elevations.add(tier.elevation);
    }

    for (const { cell, index } of tier.cells) {
      if (rack.footprint === undefined && cell.rackFootprint === undefined) {
        report(index, 'rack_footprint', 'required');
      }

      if (tier.elevation === undefined && cell.tierElevationMm === undefined) {
        report(index, 'tier_elevation_mm', 'required');
      }
    }

    if (tier.cells.length > 0 && rack.footprint !== undefined) {
      checkCellIntervals(tier, rack.footprint.widthMm, report);
    }
  }
};

const createRectangle = (footprint: WarehouseFloorRect, rack: RackValue | undefined): RackRectangleValue => {
  const { origin } = footprint;

  if (origin === undefined) {
    throw new Error('Warehouse rectangle requires an origin');
  }

  return {
    maxX: origin.xMm + footprint.widthMm,
    maxZ: origin.zMm + footprint.depthMm,
    minX: origin.xMm,
    minZ: origin.zMm,
    rack,
  };
};

const createRangeMaximum = (size: number): ((start: number, end: number, value: number) => number) => {
  const entireRange = new Float64Array(size * 4).fill(-Infinity);
  const anyPart = new Float64Array(size * 4).fill(-Infinity);

  const update = (start: number, end: number, value: number, node: number, left: number, right: number): number => {
    const previous = anyPart[node] ?? -Infinity;
    const previousEntireRange = entireRange[node] ?? -Infinity;
    anyPart[node] = Math.max(previous, value);

    if (start <= left && right <= end) {
      entireRange[node] = Math.max(previousEntireRange, value);

      return previous;
    }

    const middle = Math.floor((left + right) / 2);
    const leftMaximum = start < middle ? update(start, end, value, node * 2, left, middle) : -Infinity;
    const rightMaximum = middle < end ? update(start, end, value, node * 2 + 1, middle, right) : -Infinity;

    return Math.max(previousEntireRange, leftMaximum, rightMaximum);
  };

  return (start, end, value) => update(start, end, value, 1, 0, size);
};

const findOverlappingRacks = (rectangles: readonly RackRectangleValue[]): Set<RackValue> => {
  const overlapping = new Set<RackValue>();

  if (rectangles.length < 2 || rectangles.every(rectangle => rectangle.rack === undefined)) {
    return overlapping;
  }

  const points = Array.from(new Set(rectangles.flatMap(({ maxZ, minZ }) => [minZ, maxZ])))
    .sort((current, prev) => current - prev);
  const positions = new Map(points.map((point, index) => [point, index]));
  const ordered = rectangles.toSorted((current, prev) => current.minX - prev.minX).map((rectangle) => {
    const start = positions.get(rectangle.minZ);
    const end = positions.get(rectangle.maxZ);

    if (start === undefined || end === undefined) {
      throw new Error('Missing warehouse rectangle endpoint');
    }

    return { ...rectangle, end, start };
  });
  const rightmostPriorEnd = createRangeMaximum(points.length - 1);
  const nearestLaterStart = createRangeMaximum(points.length - 1);

  for (const { end, maxX, minX, rack, start } of ordered) {
    const priorEnd = rightmostPriorEnd(start, end, maxX);

    if (rack !== undefined && priorEnd > minX) {
      overlapping.add(rack);
    }
  }

  for (const { end, maxX, minX, rack, start } of ordered.reverse()) {
    const laterStart = -nearestLaterStart(start, end, -minX);

    if (rack !== undefined && laterStart < maxX) {
      overlapping.add(rack);
    }
  }

  return overlapping;
};

const checkRacks = (
  zones: Map<string, ZoneValue>,
  current: undefined | WarehouseTopology,
  report: ReportViolation,
): void => {
  const rectangles: RackRectangleValue[] = [];
  const receiving = current?.receivingArea?.footprint;

  if (receiving !== undefined) {
    rectangles.push(createRectangle(receiving, undefined));
  }

  for (const zone of zones.values()) {
    for (const row of zone.rows.values()) {
      for (const rack of row.racks.values()) {
        checkRackTiers(rack, report);

        if (rack.footprint !== undefined) {
          rectangles.push(createRectangle(rack.footprint, rack.current === undefined ? rack : undefined));
        }
      }
    }
  }

  for (const rack of findOverlappingRacks(rectangles)) {
    for (const tier of rack.tiers.values()) {
      for (const { index } of tier.cells) {
        report(index, 'rack_footprint', 'warehouse.rack_overlap');
      }
    }
  }
};

const materializeZones = (zones: Map<string, ZoneValue>, allocateId: () => string, addedCellIds: string[]): WarehouseStorageZone[] =>
  Array.from(zones.values(), zone => create(WarehouseStorageZoneSchema, {
    ...zone.current,
    code: zone.code,
    id: zone.current?.id ?? allocateId(),
    rows: Array.from(zone.rows.values(), row => create(WarehouseRowSchema, {
      ...row.current,
      code: row.code,
      id: row.current?.id ?? allocateId(),
      racks: Array.from(row.racks.values(), rack => create(WarehouseRackSchema, {
        ...rack.current,
        code: rack.code,
        footprint: rack.footprint,
        id: rack.current?.id ?? allocateId(),
        tiers: Array.from(rack.tiers.values(), tier => create(WarehouseTierSchema, {
          ...tier.current,
          cells: [
            ...(tier.current?.cells ?? []),
            ...tier.cells.map(({ cell }) => {
              const id = allocateId();
              addedCellIds.push(id);

              return create(WarehouseCellSchema, { code: cell.cellCode, id, widthMm: cell.widthMm, xOffsetMm: cell.xOffsetMm });
            }),
          ],
          code: tier.code,
          elevationMm: tier.elevation ?? 0,
          id: tier.current?.id ?? allocateId(),
        })),
      })),
    })),
  }));

export const planWarehouseCells = (
  current: undefined | WarehouseTopology,
  cells: readonly WarehouseCellInput[],
): WarehouseCellPlanValue => {
  const violations: WarehouseCellViolationValue[] = [];
  const report: ReportViolation = (index, fieldPath, ruleId) => {
    violations.push({ fieldPath, index, ruleId });
  };
  const cellCodes = new Set<string>();
  const zones = indexTopology(current, cellCodes);

  if (cells.length > MAX_CELLS) {
    report(MAX_CELLS, 'cell_code', 'repeated.max_items');
  }

  cells.slice(0, MAX_CELLS).forEach((cell, index) => {
    stageCell(zones, cellCodes, cell, index, report);
  });
  checkRacks(zones, current, report);
  violations.sort((current, prev) => current.index - prev.index);

  return {
    materialize: (warehouseId, tenantId, allocateId) => {
      const revision = (current?.revision ?? 0) + 1;

      if (violations.length > 0 || cells.length === 0 || revision > MAX_UINT32) {
        throw new Error('Invalid warehouse cell plan');
      }

      const addedCellIds: string[] = [];
      const topology = create(WarehouseTopologySchema, {
        ...current,
        revision,
        storageZones: materializeZones(zones, allocateId, addedCellIds),
        tenantId,
        warehouseId,
      });

      return { addedCellIds, topology };
    },
    violations,
  };
};
