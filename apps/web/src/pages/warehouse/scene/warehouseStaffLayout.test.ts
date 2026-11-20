import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';
import { WarehouseStaffWorkRole } from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  WarehouseSceneStaffAreaValue,
  WarehouseSceneStaffPersonValue,
} from '../model/warehouseSceneInteraction';

import { getWarehouseLayout } from './warehouseLayout';
import { buildWarehouseStaffLayout } from './warehouseStaffLayout';

const person = (staffId: string): WarehouseSceneStaffPersonValue =>
  ({ avatarKey: 'forklift_operator', displayName: staffId, staffId, workRole: WarehouseStaffWorkRole.FORKLIFT_OPERATOR });

const area = (areaId: string, staff: string[]): WarehouseSceneStaffAreaValue => ({
  areaId, counter: { comparison: 'shortage', label: '1 of 2', text: '1/2' }, staff: staff.map(person),
});

const sceneTopology = (sideMm = 3_000): WarehouseTopology => create(WarehouseTopologySchema, {
  receivingArea: { footprint: { depthMm: sideMm, origin: {}, widthMm: sideMm }, id: 'dock' },
  storageZones: [{
    id: 'storage',
    rows: [{ racks: [{ footprint: { depthMm: 1_000, origin: { xMm: 6_000 }, widthMm: 2_000 } }] }],
  }, { id: 'unknown' }],
});

describe('warehouse staff placement', () => {
  it('maps a recorded receiving area and the aisle in front of a legacy storage rack', () => {
    const topology = sceneTopology();
    const base = getWarehouseLayout(topology);
    const { actors, floor, markers } = buildWarehouseStaffLayout(
      [area('storage', ['worker']), area('dock', []), area('unknown', ['unknown']), area('unmapped', ['unmapped'])], topology, base,
    );
    expect(actors).toHaveLength(1);
    expect(actors[0]).toMatchObject({ areaId: 'storage', staffId: 'worker' });
    expect(actors[0]?.z).toBeGreaterThan(1.23);
    expect(markers.map(marker => marker.areaId)).toEqual(['storage', 'dock']);
    expect(floor.get('ground')).toBe(base.floor.get('ground'));
    expect(floor.get('road')?.length).toBe((base.floor.get('road')?.length ?? 0) + 2);
  });

  it('separates anonymous counters from allowed avatars and keeps one stable slot per visible worker', () => {
    const topology = sceneTopology(720);
    const base = getWarehouseLayout(topology);
    const staff = ['last', 'first', 'middle'];
    const selection = { ...area('dock', staff), counter: undefined };
    const result = buildWarehouseStaffLayout([selection], topology, base);
    expect(result.actors.map(actor => actor.staffId)).toEqual(['first']);
    expect(result.markers).toMatchObject([{ areaId: 'dock', counter: undefined, overflow: 2 }]);
    expect(buildWarehouseStaffLayout([{ ...selection, staff: [...selection.staff].reverse() }], topology, base)).toEqual(result);
    const aggregates = buildWarehouseStaffLayout([area('dock', [])], topology, base);
    expect(aggregates.floor).toBe(base.floor);
    expect(aggregates.actors).toEqual([]);
    expect(aggregates.markers[0]?.overflow).toBe(0);
  });

  it('keeps a blocked area free of actors and bounds the search on a dense plan', () => {
    const topology = sceneTopology(100_000);
    const base = getWarehouseLayout(topology);
    const staff = Array.from({ length: 300 }, (_, index) => String(index));
    const areaData = [area('dock', staff)];
    const free = buildWarehouseStaffLayout(areaData, topology, { ...base, navigation: { ...base.navigation, obstacles: [] } });
    expect(free.actors).toHaveLength(256);
    expect(new Set(free.actors.map(actor => [actor.x, actor.z].join('/'))).size).toBe(256);
    expect(free.markers[0]?.overflow).toBe(44);
    const full = buildWarehouseStaffLayout(areaData, topology, {
      ...base,
      navigation: { ...base.navigation, obstacles: [{ maxX: 100, maxZ: 100, minX: 0, minZ: 0 }] },
    });
    expect(full.actors).toEqual([]);
    expect(full.floor).toBe(base.floor);
    expect(full.markers[0]?.overflow).toBe(300);
  });
});
