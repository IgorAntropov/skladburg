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
  WAREHOUSE_YARD_PARKING_SPACING,
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

  it('opens bays from the topology and connects their separate lanes at the parking apron', () => {
    const firstId = '8f000001-0000-4000-8000-000000000011';
    const secondId = '8f000001-0000-4000-8000-000000000012';
    const first = { x: 9.5, z: 5 };
    const second = { x: 1, z: first.z };
    const layout = getWarehouseLayout(create(WarehouseTopologySchema, {
      receivingArea: {
        additionalUnloadingPoints: [
          { code: 'D02', id: secondId, position: { xMm: 1000, zMm: 5000 } },
          { code: 'D03', id: '8f000001-0000-4000-8000-000000000013', position: { xMm: 8000, zMm: 5000 } },
          { code: 'D04', id: '8f000001-0000-4000-8000-000000000014', position: { xMm: 15000, zMm: 6000 } },
          { code: 'D05', id: secondId, position: { xMm: 20000, zMm: 5000 } },
          { code: 'D06', id: '8f000001-0000-4000-8000-000000000016' },
        ],
        footprint: { depthMm: 3000, origin: { xMm: 9000, zMm: 6000 }, widthMm: 4000 },
        id: 'receiving',
        unloadingPoint: { code: 'D01', id: firstId, position: { xMm: 9500, zMm: 5000 } },
      },
    }));

    const roads = layout.floor.get('road') ?? [];
    const lanes = roads.filter(({ size }) => size[2] === WAREHOUSE_DOCK_LANE_LENGTH);
    expect(lanes.map(({ position }) => position[0])).toEqual([first.x, second.x]);
    const driven = lanes.map(({ position, size }) => ({ left: position[0] - size[0] / 2, right: position[0] + size[0] / 2 }));
    expect(driven[1]?.right).toBeLessThan(driven[0]?.left ?? 0);
    const crossings = roads.filter(({ position, size }) => position[1] === 0.01 && size[0] > first.x - second.x);
    expect(crossings).toHaveLength(1);
    const crossing = crossings[0];
    if (crossing !== undefined) {
      const [x, , z] = crossing.position;
      const [width, , length] = crossing.size;
      const halfTruckWidth = 0.94;
      expect(x - width / 2).toBeLessThan(second.x - halfTruckWidth);
      expect(x - width / 2).toBeLessThan(first.x + (layout.yard?.entrance.x ?? 0) - halfTruckWidth);
      expect(x + width / 2).toBeGreaterThan(first.x + halfTruckWidth);
      expect(z + length / 2).toBeCloseTo(first.z - WAREHOUSE_DOCK_LANE_LENGTH);

      const body = [...layout.truck.values()].flat();
      const marks = layout.floor.get('sand') ?? [];
      const spaces = marks.filter(({ position, size }) => position[0] === first.x && size[0] > 2);
      expect(spaces).toHaveLength(WAREHOUSE_YARD_PARKING_LIMIT + 1);
      for (let slot = 0; slot < WAREHOUSE_YARD_PARKING_LIMIT; slot += 1) {
        const far = Math.min(...body.map(({ position, size }) => position[2] - size[2] / 2)) + readWarehouseParkingOffset(slot);
        const near = Math.max(...body.map(({ position, size }) => position[2] + size[2] / 2)) + readWarehouseParkingOffset(slot);
        expect(z - length / 2).toBeGreaterThan(near);
        expect(marks.some(({ position, size }) => size[0] > 2 && position[0] - size[0] / 2 < first.x + halfTruckWidth
          && position[0] + size[0] / 2 > second.x - halfTruckWidth
          && position[2] - size[2] / 2 < near && position[2] + size[2] / 2 > far)).toBe(false);
      }
    }

    const walls = layout.floor.get('warehouseWall') ?? [];
    const facade = walls.filter(({ position }) => position[2] === first.z);
    const indoors = walls.find(({ size }) => size[1] === 0.024);
    expect(facade).toHaveLength(3);
    expect(indoors).toBeDefined();

    const ramps = (layout.floor.get('warehouseRoof') ?? []).filter(({ position }) => position[1] === 0.16);
    expect(ramps.map(({ position }) => position[0])).toEqual([first.x, second.x]);
    expect(layout.navigation.obstacles).toHaveLength(2);
    for (const dock of [first, second]) {
      expect(facade.some(({ position, size }) => Math.abs(position[0] - dock.x) - size[0] / 2 < 1.08)).toBe(false);
      expect(layout.navigation.obstacles.some(({ maxX, maxZ, minX }) => minX < dock.x && maxX > dock.x && maxZ > dock.z)).toBe(true);
      if (indoors !== undefined) {
        expect(indoors.position[0] - indoors.size[0] / 2).toBeLessThan(dock.x - 1.25);
        expect(indoors.position[0] + indoors.size[0] / 2).toBeGreaterThan(dock.x + 1.25);
      }
    }
    expect(layout.receiving?.dock).toEqual(first);
    expect(layout.receiving?.docks).toEqual([{ ...first, id: firstId }, { ...second, id: secondId }]);
    expect(layout.truck.get('sideCarrier')?.[0]?.position[0]).toBe(first.x);
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
      position[0] === dock.x && size[2] === (WAREHOUSE_YARD_PARKING_LIMIT + 1) * WAREHOUSE_YARD_PARKING_SPACING
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
