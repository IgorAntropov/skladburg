import { create } from '@bufbuild/protobuf';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { WAREHOUSE_RACK_TIER_ELEVATIONS_MM } from '../model/warehouseRackTemplate';
import { buildWarehouseConstruction } from './warehouseConstructionLayout';
import { getWarehouseLayout } from './warehouseLayout';
import { buildWarehouseRackPosts } from './warehouseRackGeometry';

const footprint = { depthMm: 1_000, origin: { xMm: 1_700, zMm: 3_200 }, widthMm: 1_200 };
const rack = { footprint, tiers: WAREHOUSE_RACK_TIER_ELEVATIONS_MM.map(elevationMm => ({ elevationMm })) };
const topology = create(WarehouseTopologySchema, {
  revision: 3,
  storageZones: [
    { id: 'near', rows: [{ racks: [rack] }] },
    { id: 'far', rows: [{ racks: [{ ...rack, footprint: { ...footprint, origin: { xMm: 7_000, zMm: 3_200 } } }] }] },
    { id: 'outside', rows: [{ racks: [{ ...rack, footprint: { ...footprint, origin: { xMm: 12_000, zMm: 3_200 } } }] }] },
  ],
});

describe('warehouse construction scene layout', () => {
  it('draws the exact outline of a selected empty zone at its saved offset', () => {
    const boundedTopology = create(WarehouseTopologySchema, {
      storageZones: [{
        bounds: { depthMm: 4_000, origin: { xMm: 1_000, zMm: 2_000 }, widthMm: 6_000 },
        id: 'first',
      }],
    });

    const { zones } = buildWarehouseConstruction(boundedTopology, { racks: [], selectedZoneId: 'first' });

    expect(zones).toHaveLength(4);
    expect(Math.min(...zones.map(({ position, size }) => position[0] - size[0] / 2))).toBeCloseTo(1);
    expect(Math.max(...zones.map(({ position, size }) => position[0] + size[0] / 2))).toBeCloseTo(7);
    expect(Math.min(...zones.map(({ position, size }) => position[2] - size[2] / 2))).toBeCloseTo(2);
    expect(Math.max(...zones.map(({ position, size }) => position[2] + size[2] / 2))).toBeCloseTo(6);
  });

  it('fits the preview posts and both shelf outlines to the saved rack', () => {
    const { previews } = buildWarehouseConstruction(topology, {
      racks: [{ baseRevision: 3, footprint, isBlocked: false, zoneId: 'near' }],
      selectedZoneId: undefined,
    });
    const { decks, frames } = getWarehouseLayout(topology).racks;
    expect(previews).toHaveLength(12);
    expect(previews.slice(0, 4)).toEqual(buildWarehouseRackPosts(frames.slice(0, 2)));

    for (const [index, { position: [x, y, z], size: [width, , depth] }] of decks.slice(0, 2).entries()) {
      const rails = previews.slice(4 + index * 4, 8 + index * 4);
      expect(rails.map(rail => rail.position[1])).toEqual([y, y, y, y]);
      expect(Math.min(...rails.map(rail => rail.position[0] - rail.size[0] / 2))).toBeCloseTo(x - width / 2);
      expect(Math.max(...rails.map(rail => rail.position[0] + rail.size[0] / 2))).toBeCloseTo(x + width / 2);
      expect(Math.min(...rails.map(rail => rail.position[2] - rail.size[2] / 2))).toBeCloseTo(z - depth / 2);
      expect(Math.max(...rails.map(rail => rail.position[2] + rail.size[2] / 2))).toBeCloseTo(z + depth / 2);
    }
  });

  it('marks existing rack footprints only in selected and published zones', () => {
    const { blocked, previews, zones } = buildWarehouseConstruction(topology, {
      racks: [{ baseRevision: 3, footprint, isBlocked: true, zoneId: 'far' }],
      selectedZoneId: 'near',
    });

    expect(zones).toHaveLength(16);
    expect(zones.filter(({ position }) => position[0] >= 1.6 && position[0] <= 3)).toHaveLength(8);
    expect(zones.filter(({ position }) => position[0] >= 6.9 && position[0] <= 8.3)).toHaveLength(8);
    expect(blocked).toHaveLength(4);
    expect(previews).toEqual([]);
  });

  it('drops a preview and its markers when the saved revision changes', () => {
    const construction = {
      racks: [{ baseRevision: 3, footprint, isBlocked: false, zoneId: 'near' }],
      selectedZoneId: undefined,
    };

    expect(buildWarehouseConstruction({ ...topology, revision: 4 }, construction)).toEqual({ blocked: [], previews: [], zones: [] });
  });

  it('reuses the zone marker matrices while the draft moves within the same zone', () => {
    const before = buildWarehouseConstruction(topology, {
      racks: [{ baseRevision: 3, footprint, isBlocked: false, zoneId: 'near' }],
      selectedZoneId: undefined,
    });
    const after = buildWarehouseConstruction(topology, {
      racks: [{ baseRevision: 3, footprint: { ...footprint, origin: { xMm: 1_900, zMm: 3_200 } }, isBlocked: false, zoneId: 'near' }],
      selectedZoneId: undefined,
    });

    expect(after.zones).toBe(before.zones);
    expect(after.previews).not.toEqual(before.previews);
  });
});
