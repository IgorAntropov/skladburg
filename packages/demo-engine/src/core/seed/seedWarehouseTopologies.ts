import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import { WarehouseTopologySchema } from '@skladburg/contracts/wms/v1/topology';

import type { WarehouseTopologyRecordValue } from '../state/records';

import { encodeWarehouseTopology } from '../modules/wms/warehouseTopologyCodec';
import {
  SeedOrganizationId,
  SeedWarehouseId,
} from './seedIds';

const SEED_TOPOLOGY_SITES = [
  { prefix: '8f000001', tenantId: SeedOrganizationId.SUPPLIER_1, warehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1 },
  { prefix: '8f000002', tenantId: SeedOrganizationId.CUSTOMER_1, warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1 },
] as const;

interface SeedTopologySiteValue {
  prefix: string;
  tenantId: string;
  warehouseId: string;
}

export const createSeedWarehouseTopology = ({ prefix, tenantId, warehouseId }: SeedTopologySiteValue): WarehouseTopology => {
  const id = (index: number): string => `${prefix}-0000-4000-8000-${String(index).padStart(12, '0')}`;

  return create(WarehouseTopologySchema, {
    receivingArea: {
      code: 'PR01',
      footprint: { depthMm: 3_000, origin: { xMm: 1_000, zMm: 1_000 }, widthMm: 2_000 },
      id: id(10),
      unloadingPoint: { code: 'D01', id: id(11), position: { xMm: 1_000, zMm: 0 } },
    },
    revision: 1,
    storageZones: [{
      code: 'Z01',
      id: id(1),
      rows: [{
        code: 'R01',
        id: id(2),
        racks: [{
          code: 'S01',
          footprint: { depthMm: 1_000, origin: { xMm: 4_000, zMm: 1_000 }, widthMm: 1_200 },
          id: id(3),
          tiers: [
            {
              cells: [
                { code: 'Z01-R01-S01-Y01-C01', id: id(6), widthMm: 600, xOffsetMm: 0 },
                { code: 'Z01-R01-S01-Y01-C02', id: id(7), widthMm: 600, xOffsetMm: 600 },
              ],
              code: 'Y01',
              elevationMm: 0,
              id: id(4),
            },
            {
              cells: [
                { code: 'Z01-R01-S01-Y02-C01', id: id(8), widthMm: 600, xOffsetMm: 0 },
                { code: 'Z01-R01-S01-Y02-C02', id: id(9), widthMm: 600, xOffsetMm: 600 },
              ],
              code: 'Y02',
              elevationMm: 1_500,
              id: id(5),
            },
          ],
        }],
      }],
    }],
    tenantId,
    warehouseId,
  });
};

export const createSeedWarehouseTopologies = (
  findWarehouse: (id: string) => Pick<Warehouse, 'tenantId'> | undefined,
): WarehouseTopologyRecordValue[] => SEED_TOPOLOGY_SITES.flatMap(site => (
  findWarehouse(site.warehouseId)?.tenantId === site.tenantId
    ? [encodeWarehouseTopology(createSeedWarehouseTopology(site))]
    : []
));
