import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WarehouseRackFootprintValue } from './warehouseRackGrid';

import {
  createWarehouseRackGrid,
  findWarehouseRackObstacle,
  snapWarehouseRackPosition,
} from './warehouseRackGrid';

const footprint = (xMm: number, zMm: number, widthMm: number, depthMm: number): WarehouseRackFootprintValue =>
  ({ depthMm, origin: { xMm, zMm }, widthMm });

const rackAt = (xMm: number, zMm: number): WarehouseRackFootprintValue => footprint(xMm, zMm, 1_200, 1_000);

const topology = (): WarehouseTopology => create(WarehouseTopologySchema, {
  receivingArea: { footprint: footprint(0, 0, 2_000, 1_600), id: 'receiving' },
  storageZones: [
    { rows: [{ racks: [{ footprint: rackAt(2_500, 0), id: 'near-rack' }] }] },
    { rows: [{ racks: [{ footprint: footprint(7_800, 3_650, 2_123, 1_000), id: 'far-rack' }] }] },
  ],
});

describe('warehouse rack grid', () => {
  it('shows the receiving area and racks in every zone, with room past the suggestion and the last rack', () => {
    const grid = createWarehouseRackGrid(topology(), rackAt(3_000, 4_500));

    expect(grid).toMatchObject({
      depthMm: 7_500,
      obstacles: [
        { footprint: footprint(0, 0, 2_000, 1_600), id: 'receiving', kind: 'receiving' },
        { footprint: rackAt(2_500, 0), id: 'near-rack', kind: 'rack' },
        { footprint: footprint(7_800, 3_650, 2_123, 1_000), id: 'far-rack', kind: 'rack' },
      ],
      widthMm: 12_000,
    });
  });

  it('identifies intersections and accepts contact at the edges and corners', () => {
    const grid = createWarehouseRackGrid(topology(), rackAt(3_000, 4_500));

    expect(findWarehouseRackObstacle(grid, rackAt(1_999, 1_599))?.id).toBe('receiving');
    expect(findWarehouseRackObstacle(grid, rackAt(8_500, 3_000))?.id).toBe('far-rack');
    expect(findWarehouseRackObstacle(grid, rackAt(2_000, 1_000))).toBeUndefined();
    expect(findWarehouseRackObstacle(grid, rackAt(1_999, 1_600))).toBeUndefined();
    expect(findWarehouseRackObstacle(grid, rackAt(2_000, 1_600))).toBeUndefined();
  });

  it('keeps the walkway from each dock clear inside the warehouse', () => {
    const warehouse = create(WarehouseTopologySchema, {
      receivingArea: {
        additionalUnloadingPoints: [{ id: 'second-dock', position: { xMm: 5_500, zMm: 0 } }],
        footprint: footprint(0, 2_500, 7_000, 2_000),
        id: 'receiving',
        unloadingPoint: { id: 'first-dock', position: { xMm: 1_500, zMm: 0 } },
      },
    });
    const grid = createWarehouseRackGrid(warehouse, rackAt(4_000, 0));

    expect(findWarehouseRackObstacle(grid, rackAt(400, 100))?.kind).toBe('dock-approach');
    expect(findWarehouseRackObstacle(grid, rackAt(4_000, 0))?.kind).toBe('dock-approach');
    expect(findWarehouseRackObstacle(grid, rackAt(4_000, 1_880))?.kind).toBe('receiving');
    expect(findWarehouseRackObstacle(grid, footprint(4_000, 1_880, 1_200, 600))).toBeUndefined();
    expect(grid.docks).toMatchObject([{ id: 'first-dock' }, { id: 'second-dock' }]);
  });

  it('uses declared floor dimensions and blocks a rack that crosses its own zone boundary', () => {
    const bounds = footprint(600, 800, 4_000, 3_000);
    const warehouse = create(WarehouseTopologySchema, {
      bounds: footprint(0, 0, 8_000, 6_000),
      storageZones: [{ bounds, id: 'zone' }],
    });
    const grid = createWarehouseRackGrid(warehouse, rackAt(7_000, 5_000), { depthMm: 12_000, widthMm: 12_000 }, [], 'zone');

    expect(grid).toMatchObject({ depthMm: 6_000, widthMm: 8_000, zones: [{ footprint: bounds, id: 'zone' }] });
    expect(findWarehouseRackObstacle(grid, rackAt(3_400, 2_800))).toBeUndefined();
    expect(findWarehouseRackObstacle(grid, rackAt(3_500, 2_800))?.kind).toBe('outside-zone');
    expect(findWarehouseRackObstacle(grid, rackAt(500, 800))?.kind).toBe('outside-zone');
  });

  it('snaps to 100 mm and keeps the complete rack inside the floor', () => {
    const grid = createWarehouseRackGrid(create(WarehouseTopologySchema), rackAt(0, 0));

    expect(grid).toMatchObject({ depthMm: 4_000, widthMm: 6_000 });
    expect(snapWarehouseRackPosition(grid, { xMm: 249, zMm: 750 })).toEqual({ xMm: 200, zMm: 800 });
    expect(snapWarehouseRackPosition(grid, { xMm: -60, zMm: 4_001 })).toEqual({ xMm: 0, zMm: 3_000 });
    expect(snapWarehouseRackPosition(grid, { xMm: 6_001, zMm: -60 })).toEqual({ xMm: 4_800, zMm: 0 });
  });

  it('keeps the working area and clears obstacles when a rollback removes the topology', () => {
    const anchor = rackAt(0, 0);
    const current = createWarehouseRackGrid(topology(), anchor);
    const next = createWarehouseRackGrid(null, anchor, current);

    expect(next).toEqual({ depthMm: current.depthMm, obstacles: [], widthMm: current.widthMm });
  });

  it('caps both dimensions at the coordinate limit without snapping the rack past it', () => {
    const grid = createWarehouseRackGrid(create(WarehouseTopologySchema), rackAt(4_294_966_000, 4_294_966_200));

    expect(grid).toMatchObject({ depthMm: 4_294_967_295, widthMm: 4_294_967_295 });
    expect(snapWarehouseRackPosition(grid, { xMm: grid.widthMm, zMm: grid.depthMm }))
      .toEqual({ xMm: 4_294_966_000, zMm: 4_294_966_200 });
  });
});
