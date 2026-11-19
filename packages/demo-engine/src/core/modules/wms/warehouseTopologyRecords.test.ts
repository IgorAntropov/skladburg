import type {
  WarehouseCell,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import { ReceivingTaskSchema } from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseUnloadingPointSchema } from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import {
  createSeedWarehouseTopologies,
  createSeedWarehouseTopology,
} from '../../seed/seedWarehouseTopologies';
import {
  SEED_WMS_OUTBOUND_WAREHOUSE_ID,
  SEED_WMS_TOPOLOGY_PREFIX,
} from '../../seed/seedWarehouseWorkspaceConfig';
import { createTestRuntime } from '../testing/testRuntime';
import { requireInboundDock } from './inboundRecords';
import { encodeWarehouseTopology } from './warehouseTopologyCodec';
import {
  createWarehouseTopologyRecord,
  readEffectiveWarehouseDocks,
  readWarehouseTopology,
} from './warehouseTopologyRecords';

interface TopologyFixtureValue {
  first: WarehouseCell;
  second: WarehouseCell;
  topology: WarehouseTopology;
}

const createFixture = (): TopologyFixtureValue => {
  const [record] = createSeedWarehouseTopologies(id => id === SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1
    ? { tenantId: SeedOrganizationId.CUSTOMER_1 }
    : undefined);

  if (record === undefined) {
    throw new Error('Missing demo topology');
  }

  const topology = readWarehouseTopology(record);
  const [first, second] = topology.storageZones[0]?.rows[0]?.racks[0]?.tiers[0]?.cells ?? [];

  if (first === undefined || second === undefined) {
    throw new Error('Missing demo cells');
  }

  return { first, second, topology };
};

describe('createWarehouseTopologyRecord', () => {
  it('validates every shipped topology before it can be used as a fixture', () => {
    const tenantsByWarehouse = new Map<string, string>([
      [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1, SeedOrganizationId.CUSTOMER_1],
      [SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1, SeedOrganizationId.SUPPLIER_1],
    ]);
    const records = createSeedWarehouseTopologies((id) => {
      const tenantId = tenantsByWarehouse.get(id);
      return tenantId === undefined ? undefined : { tenantId };
    });
    expect(records).toHaveLength(2);
    expect(records.map(record => createWarehouseTopologyRecord(readWarehouseTopology(record)))).toEqual(records);
  });

  it('validates the generated topology for the opening stock fixture', () => {
    const topology = createSeedWarehouseTopology({
      prefix: SEED_WMS_TOPOLOGY_PREFIX, tenantId: SeedOrganizationId.SUPPLIER_1, warehouseId: SEED_WMS_OUTBOUND_WAREHOUSE_ID,
    });
    expect(createWarehouseTopologyRecord(topology)).toEqual(encodeWarehouseTopology(topology));
  });

  it('rejects an additional unloading point with the same identifier as the primary point', () => {
    const { topology } = createFixture();
    const area = topology.receivingArea;
    if (area?.unloadingPoint === undefined) {
      throw new Error('Missing demo unloading point');
    }
    area.additionalUnloadingPoints.push(area.unloadingPoint);

    expect(() => createWarehouseTopologyRecord(topology)).toThrow('duplicate identifier or cell code');
  });

  it.each([
    { name: 'missing primary', omitPrimary: true, xMm: 4_000, zMm: 0 },
    { name: 'different facade', omitPrimary: false, xMm: 4_000, zMm: 1 },
    { name: 'overlapping berth', omitPrimary: false, xMm: 3_659, zMm: 0 },
  ])('rejects a second berth with $name and keeps manual WMS on older records', async ({ omitPrimary, xMm, zMm }) => {
    const { topology } = createFixture();
    const area = topology.receivingArea;
    if (area === undefined) {
      throw new Error('Missing receiving area');
    }
    if (omitPrimary) {
      area.unloadingPoint = undefined;
    }
    area.additionalUnloadingPoints.push(create(WarehouseUnloadingPointSchema, {
      code: 'D02', id: '8f000002-0000-4000-8000-000000000012', position: { xMm, zMm },
    }));

    expect(() => createWarehouseTopologyRecord(topology)).toThrow('Warehouse unloading points');
    const { runtime } = createTestRuntime();
    await runtime.command((transaction) => {
      transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
    });
    const task = create(ReceivingTaskSchema, { receivingAreaId: area.id, warehouseId: topology.warehouseId });
    expect(() => {
      requireInboundDock(runtime.read, runtime.errors, task, topology.tenantId, 'ReceiveHandlingUnit');
    }).not.toThrow();
  });

  it('accepts two berths separated by exactly 2660 mm', () => {
    const { topology } = createFixture();
    const area = topology.receivingArea;
    if (area === undefined) {
      throw new Error('Missing receiving area');
    }
    area.additionalUnloadingPoints.push(create(WarehouseUnloadingPointSchema, {
      code: 'D02', id: '8f000002-0000-4000-8000-000000000012', position: { xMm: 3_660, zMm: 0 },
    }));
    expect(createWarehouseTopologyRecord(topology)).toEqual(encodeWarehouseTopology(topology));
  });

  it('keeps the first free berth when later persisted points conflict with an accepted berth', () => {
    const { topology } = createFixture();
    const area = topology.receivingArea;
    if (area?.unloadingPoint === undefined) {
      throw new Error('Missing demo unloading point');
    }
    const firstId = '8f000002-0000-4000-8000-000000000012';
    const lastId = '8f000002-0000-4000-8000-000000000014';
    area.additionalUnloadingPoints.push(
      create(WarehouseUnloadingPointSchema, { code: 'D02', id: firstId, position: { xMm: 6_500, zMm: 0 } }),
      create(WarehouseUnloadingPointSchema, {
        code: 'D03', id: '8f000002-0000-4000-8000-000000000013', position: { xMm: 4_000, zMm: 0 },
      }),
      create(WarehouseUnloadingPointSchema, { code: 'D04', id: lastId, position: { xMm: 9_160, zMm: 0 } }),
    );

    expect(readEffectiveWarehouseDocks(area).map(({ id }) => id)).toEqual([area.unloadingPoint.id, firstId, lastId]);
  });

  it.each(['code', 'id'] as const)('rejects duplicate cell %s', (key) => {
    const { first, second, topology } = createFixture();
    second[key] = first[key];

    expect(() => createWarehouseTopologyRecord(topology)).toThrow('duplicate identifier or cell code');
  });

  it.each([599, 601])('rejects a cell at offset %i when it overlaps or extends outside the rack', (xOffsetMm) => {
    const { second, topology } = createFixture();
    second.xOffsetMm = xOffsetMm;

    expect(() => createWarehouseTopologyRecord(topology)).toThrow('overlaps another cell or exceeds the rack width');
  });
  it('rejects a rack footprint with no depth', () => {
    const { topology } = createFixture();
    const rack = topology.storageZones[0]?.rows[0]?.racks[0];

    if (rack?.footprint === undefined) {
      throw new Error('Missing demo rack');
    }

    rack.footprint.depthMm = 0;

    expect(() => createWarehouseTopologyRecord(topology)).toThrow('requires positive dimensions');
  });
});
