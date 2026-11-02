import type { WarehouseAvailability } from '@skladburg/contracts/catalog/v1/catalog';
import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import {
  AvailabilityStatus,
  WarehouseAvailabilitySchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { WarehouseSchema } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { projectCityAvailability } from './cityAvailability';

const WAREHOUSE_1 = '81000000-0000-4000-8000-000000000001';
const WAREHOUSE_2 = '81000000-0000-4000-8000-000000000002';
const WAREHOUSE_3 = '81000000-0000-4000-8000-000000000003';
const WAREHOUSE_OFF_MAP = '81000000-0000-4000-8000-000000000009';

const CITY_A = '31000000-0000-4000-8000-000000000001';
const CITY_B = '31000000-0000-4000-8000-000000000002';

const warehouse = (id: string, cityId: string, mapNodeId: string): Warehouse =>
  create(WarehouseSchema, { cityId, id, mapNodeId });

const entry = (warehouseId: string, status: AvailabilityStatus, quantity: bigint): WarehouseAvailability =>
  create(WarehouseAvailabilitySchema, { quantity, status, warehouseId });

const warehouses: ReadonlyMap<string, Warehouse> = new Map([
  [WAREHOUSE_1, warehouse(WAREHOUSE_1, CITY_A, 'node-a1')],
  [WAREHOUSE_2, warehouse(WAREHOUSE_2, CITY_A, 'node-a2')],
  [WAREHOUSE_3, warehouse(WAREHOUSE_3, CITY_B, 'node-b1')],
]);

describe('projectCityAvailability', () => {
  it('sums two warehouses of one city, takes the better status and the node of the smallest warehouse id', () => {
    const result = projectCityAvailability(
      [entry(WAREHOUSE_2, AvailabilityStatus.IN_STOCK, 70n), entry(WAREHOUSE_1, AvailabilityStatus.LOW, 5n)],
      warehouses,
    );

    expect(result).toEqual([{ cityId: CITY_A, mapNodeId: 'node-a1', quantity: 75n, status: AvailabilityStatus.IN_STOCK }]);
  });

  it.each([
    ['in stock over low', AvailabilityStatus.LOW, AvailabilityStatus.IN_STOCK, AvailabilityStatus.IN_STOCK],
    ['low over on order', AvailabilityStatus.ON_ORDER, AvailabilityStatus.LOW, AvailabilityStatus.LOW],
    ['in stock over on order', AvailabilityStatus.IN_STOCK, AvailabilityStatus.ON_ORDER, AvailabilityStatus.IN_STOCK],
    ['on order when both are on order', AvailabilityStatus.ON_ORDER, AvailabilityStatus.ON_ORDER, AvailabilityStatus.ON_ORDER],
  ])('prefers %s', (_name, first, second, expected) => {
    const result = projectCityAvailability([entry(WAREHOUSE_1, first, 1n), entry(WAREHOUSE_2, second, 1n)], warehouses);

    expect(result.map(city => city.status)).toEqual([expected]);
  });

  it('keeps cities apart and sorts them by the city id', () => {
    const result = projectCityAvailability(
      [entry(WAREHOUSE_3, AvailabilityStatus.LOW, 8n), entry(WAREHOUSE_1, AvailabilityStatus.IN_STOCK, 20n)],
      warehouses,
    );

    expect(result).toEqual([
      { cityId: CITY_A, mapNodeId: 'node-a1', quantity: 20n, status: AvailabilityStatus.IN_STOCK },
      { cityId: CITY_B, mapNodeId: 'node-b1', quantity: 8n, status: AvailabilityStatus.LOW },
    ]);
  });

  it('skips a warehouse that is not on the map and returns nothing for an empty list', () => {
    const result = projectCityAvailability(
      [entry(WAREHOUSE_OFF_MAP, AvailabilityStatus.IN_STOCK, 99n), entry(WAREHOUSE_3, AvailabilityStatus.IN_STOCK, 1n)],
      warehouses,
    );

    expect(result.map(city => city.cityId)).toEqual([CITY_B]);
    expect(projectCityAvailability([], warehouses)).toEqual([]);
  });
});
