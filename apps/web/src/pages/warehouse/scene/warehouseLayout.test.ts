import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createWarehouseTruckGeometry } from './useWarehouseTruckModel';
import { WAREHOUSE_DOCK_LANE_LENGTH } from './warehouseFloorLayout';
import { getWarehouseLayout } from './warehouseLayout';
import {
  readWarehouseParkingOffset,
  WAREHOUSE_YARD_PARKING_LIMIT,
  WAREHOUSE_YARD_PARKING_SPACING,
} from './warehouseYardParking';
import { WAREHOUSE_TRUCK_CENTER_Z } from './warehouseYardRoads';

const getTruckBounds = (): NonNullable<ReturnType<typeof createWarehouseTruckGeometry>['boundingBox']> => {
  const geometry = createWarehouseTruckGeometry();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  geometry.dispose();

  if (bounds === null) {
    throw new Error('Warehouse truck must have geometry bounds');
  }

  return bounds;
};

describe('warehouse scene layout', () => {
  it('keeps the same geometry and camera when only the revision and dock capabilities change', () => {
    const makeTopology = (revision: number, capabilities: WarehouseCapability[], xMm: number): WarehouseTopology =>
      create(WarehouseTopologySchema, {
        receivingArea: {
          footprint: { depthMm: 4_000, origin: { xMm: 0, zMm: 1_000 }, widthMm: 8_000 },
          unloadingPoint: { capabilities, id: 'dock', position: { xMm, zMm: 0 } },
        },
        revision,
        warehouseId: 'warehouse',
      });

    const before = getWarehouseLayout(makeTopology(1, [WarehouseCapability.RAMP], 2_000));
    const unchanged = getWarehouseLayout(makeTopology(2, [WarehouseCapability.RAMP, WarehouseCapability.COLD], 2_000));
    const moved = getWarehouseLayout(makeTopology(3, [WarehouseCapability.RAMP, WarehouseCapability.COLD], 3_000));

    expect(unchanged).toBe(before);
    expect(moved.receiving?.dock?.x).toBe(3);
    expect(moved.yard).not.toBe(before.yard);
  });

  it('uses the saved warehouse dimensions for the slab and frames its grounds on an empty plan', () => {
    const topology = create(WarehouseTopologySchema, { bounds: { depthMm: 8_000, origin: {}, widthMm: 12_000 } });

    const { floor, world } = getWarehouseLayout(topology);
    const ground = floor.get('ground')?.[0];

    expect(floor.get('road')).toContainEqual({ position: [6, -0.17, 4], size: [12, 0.22, 8] });
    expect(world.home.radius).toBeGreaterThanOrEqual(Math.hypot(12, 8) / 2);
    expect(ground?.size[0]).toBeCloseTo(world.bounds.maxX - world.bounds.minX);
    expect(ground?.size[2]).toBeCloseTo(world.bounds.maxZ - world.bounds.minZ);
  });

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
    expect(layout.yard).toBeUndefined();
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
    const joints = layout.floor.get('plaza')?.filter(({ size }) => size[1] === 0.008) ?? [];

    expect(floors.some(({ size: [width, , depth] }) => width > 127 && depth > 70)).toBe(true);
    expect(joints.length).toBeGreaterThan(0);
    expect(joints.length).toBeLessThanOrEqual(64);
  });

  it('anchors the dock at the configured point', () => {
    const layout = getWarehouseLayout(create(WarehouseTopologySchema, {
      receivingArea: {
        footprint: { depthMm: 3000, origin: { xMm: 9000, zMm: 6000 }, widthMm: 4000 },
        id: 'receiving',
        unloadingPoint: { position: { xMm: 9500, zMm: 5000 } },
      },
    }));

    expect(layout.receiving?.dock).toEqual({ x: 9.5, z: 5 });
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
    const lanes = roads.filter(({ size }) => size[2] === -(layout.yard?.apron.maxZ ?? 0));
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
      expect(z + length / 2).toBeCloseTo(first.z + (layout.yard?.apron.maxZ ?? 0));

      const slabs = roads.filter(({ position }) => position[1] === -0.17);
      for (const edgeX of [x - width / 2, x + width / 2]) {
        for (const edgeZ of [z - length / 2 + 0.01, z + length / 2 - 0.01]) {
          expect(slabs.some(({ position: [slabX, , slabZ], size: [slabWidth, , slabDepth] }) => (
            Math.abs(edgeX - slabX) <= slabWidth / 2 && Math.abs(edgeZ - slabZ) <= slabDepth / 2
          ))).toBe(true);
        }
      }

      const truck = getTruckBounds();
      const truckCenterZ = first.z + WAREHOUSE_TRUCK_CENTER_Z;
      const marks = layout.floor.get('sand') ?? [];
      const spaces = marks.filter(({ position, size }) => position[0] === first.x && size[0] > 2);
      expect(spaces).toHaveLength(WAREHOUSE_YARD_PARKING_LIMIT + 1);
      for (let slot = 0; slot < WAREHOUSE_YARD_PARKING_LIMIT; slot += 1) {
        const far = truckCenterZ + truck.min.z + readWarehouseParkingOffset(slot);
        const near = truckCenterZ + truck.max.z + readWarehouseParkingOffset(slot);
        expect(z - length / 2).toBeGreaterThan(near);
        expect(marks.some(({ position, size }) => size[0] > 2 && position[0] - size[0] / 2 < first.x + halfTruckWidth
          && position[0] + size[0] / 2 > second.x - halfTruckWidth
          && position[2] - size[2] / 2 < near && position[2] + size[2] / 2 > far)).toBe(false);
      }
    }

    const walls = layout.floor.get('warehouseWall') ?? [];
    const facade = walls.filter(({ position, size }) => position[2] === first.z && size[2] === 0.16);
    const indoors = walls.find(({ size }) => size[1] === 0.024);
    expect(facade.length).toBeGreaterThanOrEqual(3);
    expect(indoors).toBeDefined();

    const ramps = (layout.floor.get('warehouseRoof') ?? []).filter(({ position, size }) => (
      size[0] > 1.6 && Math.abs(position[1] + size[1] / 2 - 0.32) < 0.001
    ));
    expect(new Set(ramps.map(({ position }) => position[0]))).toEqual(new Set([first.x, second.x]));
    const gates = layout.floor.get('windowGlass') ?? [];
    const truck = getTruckBounds();
    expect(layout.navigation.obstacles).toHaveLength(2);
    for (const dock of [first, second]) {
      expect(facade.some(({ position, size }) => Math.abs(position[0] - dock.x) - size[0] / 2 < 1.08)).toBe(false);
      const curtains = gates.filter(({ position, size }) => (
        Math.abs(position[0] - dock.x) < 1.3 && position[2] < dock.z && size[1] > truck.max.y
      ));
      expect(curtains).toHaveLength(2);
      for (const { position, size } of curtains) {
        expect(Math.abs(position[0] - dock.x) - size[0] / 2).toBeGreaterThan(truck.max.x);
      }
      expect(layout.navigation.obstacles.some(({ maxX, maxZ, minX }) => minX < dock.x && maxX > dock.x && maxZ > dock.z)).toBe(true);
      if (indoors !== undefined) {
        expect(indoors.position[0] - indoors.size[0] / 2).toBeLessThan(dock.x - 1.25);
        expect(indoors.position[0] + indoors.size[0] / 2).toBeGreaterThan(dock.x + 1.25);
      }
    }
    expect(layout.receiving?.dock).toEqual(first);
    expect(layout.receiving?.docks).toEqual([{ ...first, id: firstId }, { ...second, id: secondId }]);
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
    const truck = getTruckBounds();
    const truckCenterZ = dock.z + WAREHOUSE_TRUCK_CENTER_Z;
    expect(WAREHOUSE_YARD_PARKING_LIMIT).toBe(3);
    let previousFrontZ = approachEndZ;
    for (let index = 0; index < WAREHOUSE_YARD_PARKING_LIMIT; index += 1) {
      const offset = readWarehouseParkingOffset(index);
      const nearestMark = markers[index] ?? approachEndZ;
      const farthestMark = markers[index + 1] ?? approachEndZ;
      const frontZ = truckCenterZ + truck.min.z + offset;
      const rearZ = truckCenterZ + truck.max.z + offset;
      const truckHalfWidth = Math.max(-truck.min.x, truck.max.x);

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

  it.each([
    { coordinates: [1] },
    { coordinates: [1, 7.2] },
    { coordinates: [1, 7.2, 13.6, 20, 26.4, 32.8] },
  ])(
    'has room to frame the apron at the maximum zoom-out on a 390px viewport for $coordinates',
    ({ coordinates }) => {
      const docks = coordinates.map((x, index) => ({ id: `dock-${String(index + 1)}`, position: { xMm: Math.round(x * 1_000), zMm: 0 } }));
      const { world, yard } = getWarehouseLayout(create(WarehouseTopologySchema, {
        receivingArea: {
          additionalUnloadingPoints: docks.slice(1),
          footprint: { depthMm: 3_000, origin: { xMm: 1_000, zMm: 1_000 }, widthMm: 2_000 },
          unloadingPoint: docks[0],
        },
      }));
      if (yard === undefined) {
        throw new Error('Expected a warehouse apron');
      }

      const { apron } = yard;
      const viewportWidth = 390;
      const viewportHeight = 844;
      const freeWidth = viewportWidth - 20;
      const panelBottom = 170;
      const floorElevation = Math.atan(1 / Math.SQRT2);
      const viewportFootprint = Math.hypot(viewportWidth / 2, (viewportHeight + panelBottom) / 2 / Math.sin(floorElevation));
      const { maxX, maxZ, minX, minZ } = world.bounds;
      const worldEdgeAndPanMargin = 18;
      const zoomOut = viewportFootprint / (Math.min(maxX - minX, maxZ - minZ) / 2 - worldEdgeAndPanMargin);
      const yardAtIsometricAngle = (apron.maxX - apron.minX + apron.maxZ - apron.minZ) / Math.SQRT2;

      expect(yardAtIsometricAngle * zoomOut).toBeLessThan(freeWidth);
    },
  );

  it('frames a shifted six-dock yard and draws the apron at the bounds used by the routes', () => {
    const coordinates = [18_000, 6_000, 12_000, 23_000, 30_000, 47_000];
    const docks = coordinates.map((xMm, index) => ({ id: `dock-${String(index + 1)}`, position: { xMm, zMm: 5_000 } }));
    const primary = { x: 18, z: 5 };
    const layout = getWarehouseLayout(create(WarehouseTopologySchema, {
      bounds: { depthMm: 15_000, origin: { xMm: 5_000, zMm: 5_000 }, widthMm: 45_000 },
      receivingArea: {
        additionalUnloadingPoints: docks.slice(1),
        footprint: { depthMm: 3_000, origin: { xMm: 5_000, zMm: 5_000 }, widthMm: 44_000 },
        unloadingPoint: docks[0],
      },
    }));
    const { apron, entrance, parkingMouthZ } = layout.yard ?? {};
    if (apron === undefined || entrance === undefined || parkingMouthZ === undefined) {
      throw new Error('Expected geometry for the six-dock yard');
    }
    expect(layout.receiving?.docks.map(dock => dock.x)).toEqual(coordinates.map(x => x / 1_000));
    expect(layout.floor.get('road')).toContainEqual({
      position: [primary.x + (apron.minX + apron.maxX) / 2, 0.01, primary.z + (apron.maxZ + parkingMouthZ) / 2],
      size: [apron.maxX - apron.minX, 0.02, apron.maxZ - parkingMouthZ],
    });

    for (const x of [apron.minX, apron.maxX]) {
      for (const z of [apron.minZ, apron.maxZ]) {
        expect(Math.hypot(primary.x + x - layout.world.home.centerX, primary.z + z - layout.world.home.centerZ))
          .toBeLessThan(layout.world.home.radius);
      }
    }
    expect(layout.world.bounds.minZ).toBeLessThan(primary.z + entrance.z);
  });
});
