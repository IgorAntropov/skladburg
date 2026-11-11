import type { MessageInitShape } from '@bufbuild/protobuf';
import type { WarehouseCellInput } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import {
  WarehouseCellInputSchema,
  WarehouseReceivingAreaSchema,
  WarehouseTopologySchema,
} from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { planWarehouseCells } from './warehouseCellPlan';

const createCell = (input: MessageInitShape<typeof WarehouseCellInputSchema>): WarehouseCellInput => create(WarehouseCellInputSchema, {
  rackCode: 'Стеллаж 1',
  rowCode: 'Ряд 1',
  tierCode: 'Ярус 1',
  widthMm: 500,
  zoneCode: 'Зона А',
  ...input,
});

const FOOTPRINT = { depthMm: 500, origin: { xMm: 1_000, zMm: 1_000 }, widthMm: 1_000 };

const createIds = (): (() => string) => {
  let next = 0;

  return () => {
    next += 1;

    return `fa000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
  };
};

describe('planWarehouseCells', () => {
  it('groups normalized parent codes when geometry comes after the first cell', () => {
    const cells = [
      createCell({ cellCode: ' C01 ', rowCode: ' Раи\u0306он ', zoneCode: ' Зона А ' }),
      createCell({ cellCode: 'C02', rackFootprint: FOOTPRINT, rowCode: 'Район', tierElevationMm: 0, xOffsetMm: 500 }),
    ];
    const plan = planWarehouseCells(undefined, cells);
    expect(plan.violations).toEqual([]);
    expect(cells[0]?.cellCode).toBe(' C01 ');
    const { addedCellIds, topology } = plan.materialize('warehouse', 'tenant', createIds());
    expect(topology).toMatchObject({
      revision: 1,
      storageZones: [{
        code: 'Зона А',
        rows: [{
          code: 'Район',
          racks: [{
            code: 'Стеллаж 1',
            footprint: FOOTPRINT,
            tiers: [{
              cells: [{ code: 'C01', id: addedCellIds[0] }, { code: 'C02', id: addedCellIds[1] }],
              code: 'Ярус 1',
              elevationMm: 0,
            }],
          }],
        }],
      }],
      tenantId: 'tenant',
      warehouseId: 'warehouse',
    });
    expect(new Set(addedCellIds).size).toBe(2);
  });

  it('preserves the existing receiving area and all addresses while extending a tier', () => {
    const allocateId = createIds();
    const base = planWarehouseCells(undefined, [
      createCell({ cellCode: 'C01', rackFootprint: FOOTPRINT, tierElevationMm: 0 }),
    ]).materialize('warehouse', 'tenant', allocateId).topology;
    const current = {
      ...base,
      receivingArea: create(WarehouseReceivingAreaSchema, {
        code: 'Приёмка',
        footprint: { depthMm: 500, origin: { xMm: 0, zMm: 0 }, widthMm: 500 },
        id: allocateId(),
        unloadingPoint: { code: 'Д1', id: allocateId(), position: { xMm: 0, zMm: 500 } },
      }),
    };
    const plan = planWarehouseCells(current, [createCell({ cellCode: 'C02', xOffsetMm: 500 })]);
    expect(plan.violations).toEqual([]);
    const result = plan.materialize('warehouse', 'tenant', allocateId);
    const rack = result.topology.storageZones[0]?.rows[0]?.racks[0];
    const originalRack = current.storageZones[0]?.rows[0]?.racks[0];
    expect(result.topology.revision).toBe(2);
    expect(result.topology.receivingArea).toEqual(current.receivingArea);
    expect(result.topology.storageZones[0]?.id).toBe(current.storageZones[0]?.id);
    expect(result.topology.storageZones[0]?.rows[0]?.id).toBe(current.storageZones[0]?.rows[0]?.id);
    expect(rack?.id).toBe(originalRack?.id);
    expect(rack?.footprint).toEqual(originalRack?.footprint);
    expect(rack?.tiers[0]?.id).toBe(originalRack?.tiers[0]?.id);
    expect(originalRack?.tiers[0]?.cells).toHaveLength(1);
    expect(rack?.tiers[0]?.cells).toEqual([
      originalRack?.tiers[0]?.cells[0],
      expect.objectContaining({ code: 'C02', id: result.addedCellIds[0] }),
    ]);
  });

  it('reports duplicates across paths and places offset, missing geometry and invalid code errors on their input fields', () => {
    const plan = planWarehouseCells(undefined, [
      createCell({ cellCode: 'C01', rackFootprint: FOOTPRINT, tierElevationMm: 0 }),
      createCell({ cellCode: ' C01 ', rackCode: 'Стеллаж 2', xOffsetMm: 500 }),
      createCell({ cellCode: 'C03', xOffsetMm: 400 }),
      createCell({ cellCode: 'C04', xOffsetMm: 501 }),
      createCell({ cellCode: 'c05' }),
    ]);
    expect(plan.violations).toEqual(expect.arrayContaining([
      { fieldPath: 'cell_code', index: 1, ruleId: 'warehouse.cell_code_duplicate' },
      { fieldPath: 'rack_footprint', index: 1, ruleId: 'required' },
      { fieldPath: 'tier_elevation_mm', index: 1, ruleId: 'required' },
      { fieldPath: 'x_offset_mm', index: 2, ruleId: 'warehouse.cell_overlap' },
      { fieldPath: 'x_offset_mm', index: 3, ruleId: 'warehouse.cell_outside_rack' },
      { fieldPath: 'cell_code', index: 4, ruleId: 'string.pattern' },
    ]));
    expect(() => plan.materialize('warehouse', 'tenant', createIds())).toThrow();
  });

  it('rejects conflicting geometry for one rack or tier and two tiers at the same elevation', () => {
    const plan = planWarehouseCells(undefined, [
      createCell({ cellCode: 'C01', rackFootprint: FOOTPRINT, tierElevationMm: 0 }),
      createCell({ cellCode: 'C02', rackFootprint: { ...FOOTPRINT, widthMm: 900 }, tierElevationMm: 10, xOffsetMm: 500 }),
      createCell({ cellCode: 'C03', tierCode: 'Ярус 2', tierElevationMm: 0 }),
    ]);
    expect(plan.violations).toEqual(expect.arrayContaining([
      { fieldPath: 'rack_footprint', index: 1, ruleId: 'warehouse.rack_geometry_conflict' },
      { fieldPath: 'tier_elevation_mm', index: 1, ruleId: 'warehouse.tier_elevation_conflict' },
      { fieldPath: 'tier_elevation_mm', index: 2, ruleId: 'warehouse.tier_elevation_duplicate' },
    ]));
  });

  it('rejects fractional and out-of-range millimeters and zero dimensions on their own fields', () => {
    const plan = planWarehouseCells(undefined, [createCell({
      cellCode: 'C01',
      rackFootprint: { ...FOOTPRINT, depthMm: 0, origin: { xMm: 4_294_967_296, zMm: 0 } },
      tierElevationMm: 0,
      widthMm: 0,
      xOffsetMm: 1.5,
    })]);
    expect(plan.violations.map(violation => violation.fieldPath).sort()).toEqual([
      'rack_footprint.depth_mm',
      'rack_footprint.origin.x_mm',
      'width_mm',
      'x_offset_mm',
    ]);
  });

  it('reports overlapping new racks and preserves shared edges with racks and receiving area', () => {
    const current = create(WarehouseTopologySchema, {
      receivingArea: { footprint: FOOTPRINT },
      revision: 1,
    });
    const cells = [
      createCell({
        cellCode: 'C01',
        rackFootprint: { ...FOOTPRINT, origin: { xMm: 2_000, zMm: 1_000 } },
        tierElevationMm: 0,
      }),
      createCell({
        cellCode: 'C02',
        rackCode: 'Стеллаж 2',
        rackFootprint: { ...FOOTPRINT, origin: { xMm: 2_000, zMm: 1_500 } },
        tierElevationMm: 0,
      }),
      createCell({
        cellCode: 'C03',
        rackCode: 'Стеллаж 3',
        rackFootprint: { ...FOOTPRINT, depthMm: 400, origin: { xMm: 1_500, zMm: 1_100 } },
        tierElevationMm: 0,
      }),
    ];
    expect(planWarehouseCells(current, cells.slice(0, 2)).violations).toEqual([]);
    expect(planWarehouseCells(current, cells).violations).toEqual([
      { fieldPath: 'rack_footprint', index: 0, ruleId: 'warehouse.rack_overlap' },
      { fieldPath: 'rack_footprint', index: 2, ruleId: 'warehouse.rack_overlap' },
    ]);
  });

  it('accepts ten thousand non-overlapping cells in one tier', () => {
    const cells = Array.from({ length: 9_999 }, (_, index) => createCell({
      cellCode: `C${String(index)}`,
      widthMm: 1,
      xOffsetMm: index,
    }));
    cells.push(createCell({
      cellCode: 'C9999',
      rackFootprint: { ...FOOTPRINT, widthMm: 10_000 },
      tierElevationMm: 0,
      widthMm: 1,
      xOffsetMm: 9_999,
    }));
    const plan = planWarehouseCells(undefined, cells);
    expect(plan.violations).toEqual([]);
    expect(plan.materialize('warehouse', 'tenant', createIds()).addedCellIds).toHaveLength(10_000);
  });

  it('reports an earlier rack that contains another and both racks when their X intervals coincide', () => {
    const cells = [
      createCell({ cellCode: 'C01', rackFootprint: FOOTPRINT, tierElevationMm: 0 }),
      createCell({
        cellCode: 'C02',
        rackCode: 'Стеллаж 2',
        rackFootprint: { ...FOOTPRINT, origin: { xMm: 1_250, zMm: 1_100 }, widthMm: 500 },
        tierElevationMm: 0,
      }),
      createCell({
        cellCode: 'C03',
        rackCode: 'Стеллаж 3',
        rackFootprint: { ...FOOTPRINT, origin: { xMm: 1_000, zMm: 1_200 } },
        tierElevationMm: 0,
      }),
    ];
    expect(planWarehouseCells(undefined, cells).violations).toEqual([
      { fieldPath: 'rack_footprint', index: 0, ruleId: 'warehouse.rack_overlap' },
      { fieldPath: 'rack_footprint', index: 1, ruleId: 'warehouse.rack_overlap' },
      { fieldPath: 'rack_footprint', index: 2, ruleId: 'warehouse.rack_overlap' },
    ]);
  });
});
