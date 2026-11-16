import { create } from '@bufbuild/protobuf';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { WAREHOUSE_DOCK_LANE_LENGTH } from './warehouseFloorLayout';
import { getWarehouseLayout } from './warehouseLayout';
import {
  readWarehouseParkingOffset,
  WAREHOUSE_YARD_PARKING_LIMIT,
} from './warehouseYardParking';

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
    expect(layout.racks.frames.map(({ position }) => position[0])).toEqual([4, 6.4]);
    expect(layout.racks.decks[0]?.size[2]).toBeCloseTo(1.6);
    expect(layout.racks.decks[0]?.position[1]).toBeCloseTo(2.088);
    const hasConcrete = layout.floor.get('warehouseWall')?.some(({ size }) => size[1] === 0.024);
    expect(hasConcrete).toBe(true);
  });

  it('expands the slab to fit distant racks and bounds the number of floor joints', () => {
    const layout = getWarehouseLayout(create(WarehouseTopologySchema, {
      storageZones: [{
        rows: [{
          racks: [
            { footprint: { depthMm: 1000, origin: { xMm: 2000, zMm: 3000 }, widthMm: 1600 } },
            { footprint: { depthMm: 1600, origin: { xMm: 124_000, zMm: 69_000 }, widthMm: 3200 } },
          ],
        }],
      }],
    }));

    expect(layout.racks.frames).toHaveLength(4);
    expect(layout.world.home.centerX).toBeGreaterThan(60);
    const floors = layout.floor.get('warehouseWall') ?? [];
    const joints = layout.floor.get('plaza') ?? [];

    expect(floors.some(({ size: [width, , depth] }) => width > 127 && depth > 70)).toBe(true);
    expect(joints.length).toBeGreaterThan(0);
    expect(joints.length).toBeLessThanOrEqual(64);
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
    expect(layout.navigation.bounds.minZ).toBeCloseTo(5.11);
  });

  it('fits three separated trucks into marked spaces behind the dock lane', () => {
    const dock = { x: 9.5, z: 5 };
    const layout = getWarehouseLayout(create(WarehouseTopologySchema, {
      receivingArea: {
        footprint: { depthMm: 3000, origin: { xMm: 9000, zMm: 6000 }, widthMm: 4000 },
        id: 'receiving',
        unloadingPoint: { position: { xMm: 9500, zMm: 5000 } },
      },
    }));
    const approachEndZ = dock.z - WAREHOUSE_DOCK_LANE_LENGTH;
    const pavement = layout.floor.get('road')?.find(({ position, size }) => (
      position[0] === dock.x && Math.abs(position[2] + size[2] / 2 - approachEndZ) < 0.001
    ));
    expect(pavement).toBeDefined();
    if (pavement === undefined) {
      return;
    }

    const markers = (layout.floor.get('sand') ?? [])
      .filter(({ position, size }) => position[0] === dock.x && position[2] <= approachEndZ && size[0] > 2)
      .map(({ position }) => position[2])
      .sort((first, second) => second - first);
    expect(markers).toHaveLength(WAREHOUSE_YARD_PARKING_LIMIT + 1);
    const body = [...layout.truck.values()].flat();
    expect(body.length).toBeGreaterThan(0);
    expect(WAREHOUSE_YARD_PARKING_LIMIT).toBe(3);
    expect(readWarehouseParkingOffset(0)).toBe(-10.4);
    let previousFrontZ = approachEndZ;
    for (let index = 0; index < WAREHOUSE_YARD_PARKING_LIMIT; index += 1) {
      const offset = readWarehouseParkingOffset(index);
      const nearestMark = markers[index] ?? approachEndZ;
      const farthestMark = markers[index + 1] ?? approachEndZ;
      const frontZ = Math.min(...body.map(({ position, size }) => position[2] - size[2] / 2 + offset));
      const rearZ = Math.max(...body.map(({ position, size }) => position[2] + size[2] / 2 + offset));
      const truckHalfWidth = Math.max(...body.map(({ position, size }) => Math.abs(position[0] - dock.x) + size[0] / 2));

      expect(truckHalfWidth).toBeLessThan(pavement.size[0] / 2);
      expect(rearZ).toBeLessThan(nearestMark);
      expect(frontZ).toBeGreaterThan(farthestMark);
      expect(rearZ).toBeLessThan(previousFrontZ - 0.5);
      expect(frontZ).toBeGreaterThan(layout.world.bounds.minZ);
      previousFrontZ = frontZ;
    }
    expect(layout.world.home.centerZ).toBeCloseTo(2.73);
    expect(layout.world.home.radius).toBeCloseTo(Math.hypot(16.1, 15.84) * 0.52);
  });
});
