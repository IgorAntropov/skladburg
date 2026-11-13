import { create } from '@bufbuild/protobuf';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { getWarehouseLayout } from './warehouseLayout';

describe('warehouse scene layout', () => {
  it('reads the rack footprint, cell offset and tier elevation from imported topology', () => {
    const topology = create(WarehouseTopologySchema, {
      storageZones: [{
        rows: [{
          racks: [{
            footprint: { depthMm: 1600, origin: { xMm: 4000, zMm: 3000 }, widthMm: 2400 },
            tiers: [{
              cells: [{ id: 'first', widthMm: 800, xOffsetMm: 600 }],
              elevationMm: 2000,
            }],
          }],
        }],
      }],
    });

    const layout = getWarehouseLayout(topology);
    expect(layout.receiving).toBeUndefined();
    expect(layout.truck.size).toBe(0);
    const cell = layout.cellsById.get('first');
    expect(cell?.position[0]).toBeCloseTo(5);
    expect(cell?.position[1]).toBeCloseTo(2.147);
    expect(cell?.position[2]).toBeCloseTo(3.8);
    expect(cell?.size[0]).toBeCloseTo(0.8);
  });

  it('anchors the dock and truck at the configured point', () => {
    const layout = getWarehouseLayout(create(WarehouseTopologySchema, {
      receivingArea: {
        footprint: { depthMm: 3000, origin: { xMm: 9000, zMm: 6000 }, widthMm: 4000 },
        id: 'receiving',
        unloadingPoint: { position: { xMm: 9500, zMm: 5000 } },
      },
    }));

    expect(layout.receiving?.dock).toEqual({ x: 9.5, z: 5 });
    expect(layout.truck.get('sideCarrier')?.[0]?.position[0]).toBe(9.5);
  });
});
