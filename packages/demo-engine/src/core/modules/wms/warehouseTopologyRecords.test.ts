import type {
  WarehouseCell,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { createSeedWarehouseTopologies } from '../../seed/seedWarehouseTopologies';
import {
  createWarehouseTopologyRecord,
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
