import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import { TripSchema } from '@skladburg/contracts/logistics/v1/logistics';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  PickingTaskSchema,
  PickingTaskStatus,
} from '@skladburg/contracts/wms/v1/picking';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  WarehouseYardFactsInputValue,
  WarehouseYardFactsValue,
} from './warehouseYardFacts';

import { projectWarehouseCargo } from './projectWarehouseCargo';
import { readWarehouseDockDeparture } from './warehouseSceneCargo';
import { acceptWarehouseYardFacts } from './warehouseYardFacts';

const WAREHOUSE_ID = 'warehouse';
const RECEIVING_AREA_ID = 'receiving';
const FIRST_WORKSPACE = 'org:user:warehouse';

const receipt = (version: number, status: ReceivingTaskStatus): ReceivingTask =>
  create(ReceivingTaskSchema, {
    id: 'receipt', receivingAreaId: RECEIVING_AREA_ID, status, unloadingPointId: 'D01', version, warehouseId: WAREHOUSE_ID,
  });

const shipping = create(PickingTaskSchema, {
  dealId: 'outgoing', id: 'picking', status: PickingTaskStatus.SHIPPED, version: 7, warehouseId: WAREHOUSE_ID,
});

const route = (version: number, status: TripStatus): Trip => create(TripSchema, {
  dealId: shipping.dealId, id: 'route', pickup: { warehouseId: WAREHOUSE_ID }, status, version,
});

const source = (patch: Partial<WarehouseYardFactsInputValue> = {}): WarehouseYardFactsInputValue => ({
  picking: [], receiving: [], scope: FIRST_WORKSPACE, trips: [], warehouseId: WAREHOUSE_ID, ...patch,
});

const project = (facts: WarehouseYardFactsValue): ReturnType<typeof projectWarehouseCargo> =>
  projectWarehouseCargo(facts.receiving ?? [], RECEIVING_AREA_ID, true, {
    knownPickupDeals: facts.knownPickupDeals, picking: facts.picking, trips: facts.trips, warehouseId: WAREHOUSE_ID,
  });

describe('accepted warehouse yard facts', () => {
  it('keeps a confirmed receipt and ignores repeated and older copies of its task', () => {
    const prior = receipt(4, ReceivingTaskStatus.IN_PROGRESS);
    const completed = receipt(5, ReceivingTaskStatus.READY_FOR_RECONCILIATION);
    const first = acceptWarehouseYardFacts(undefined, source({ receiving: [prior, completed, prior] }));
    const replayed = acceptWarehouseYardFacts(first, source({ receiving: [prior, receipt(5, ReceivingTaskStatus.OPEN)] }));

    expect(first.receiving).toEqual([completed]);
    expect(replayed.receiving).toBe(first.receiving);
    expect(project(replayed).yardVisits?.get(completed.id)).toMatchObject({ phase: 'released', taskVersion: 5 });
  });

  it('accepts a newer trip independently of the picking-task version and leaves the departure confirmed', () => {
    const loading = route(4, TripStatus.LOADED);
    const departed = route(5, TripStatus.IN_TRANSIT);
    const first = acceptWarehouseYardFacts(undefined, source({ picking: [shipping], trips: [loading] }));
    const next = acceptWarehouseYardFacts(first, source({ picking: [shipping], trips: [departed] }));
    const delayedTask = { ...shipping, status: PickingTaskStatus.PICKED, version: 6 };
    const delayed = acceptWarehouseYardFacts(next, source({ picking: [delayedTask], trips: [loading] }));

    expect(project(first).yardVisits?.get(shipping.id)).toMatchObject({ phase: 'loaded', taskVersion: 7, tripVersion: 4 });
    expect(project(next).yardVisits?.get(shipping.id)).toMatchObject({ phase: 'departed', taskVersion: 7, tripVersion: 5 });
    expect(readWarehouseDockDeparture(project(delayed), shipping.id, departed.id)).toBe('route');
  });

  it('drops inaccessible lists and does not carry versions between acting scopes', () => {
    const first = acceptWarehouseYardFacts(undefined, source({
      picking: [shipping], receiving: [receipt(5, ReceivingTaskStatus.RECONCILED)], trips: [route(4, TripStatus.LOADED)],
    }));
    const lostAccess = acceptWarehouseYardFacts(first, source({ picking: undefined, receiving: undefined, trips: undefined }));
    const different = acceptWarehouseYardFacts(first, source({
      receiving: [receipt(1, ReceivingTaskStatus.OPEN)], scope: 'other:user:warehouse',
    }));

    expect(project(lostAccess).yardVisits?.size).toBe(0);
    expect(project(different).yardVisits?.get('receipt')).toMatchObject({ phase: 'assigned', taskVersion: 1 });
  });

  it('does not infer self-pickup from an unavailable trip list or a missing previously observed route', () => {
    const first = acceptWarehouseYardFacts(undefined, source({ picking: [shipping], trips: [route(4, TripStatus.LOADED)] }));
    const disappeared = acceptWarehouseYardFacts(first, source({ picking: [shipping] }));
    const denied = acceptWarehouseYardFacts(first, source({ picking: [shipping], trips: undefined }));
    const selfPickup = acceptWarehouseYardFacts(undefined, source({ picking: [shipping] }));

    expect(readWarehouseDockDeparture(project(disappeared), shipping.id)).toBeUndefined();
    expect(readWarehouseDockDeparture(project(denied), shipping.id)).toBeUndefined();
    expect(readWarehouseDockDeparture(project(selfPickup), shipping.id)).toBe('self-pickup');
  });

  it('does not revive a stale route or task that was absent from an intervening snapshot', () => {
    const latest = receipt(5, ReceivingTaskStatus.RECONCILED);
    const routing = route(5, TripStatus.IN_TRANSIT);
    const first = acceptWarehouseYardFacts(undefined, source({ picking: [shipping], receiving: [latest], trips: [routing] }));
    const omitted = acceptWarehouseYardFacts(first, source({ picking: [shipping] }));
    const replayed = acceptWarehouseYardFacts(omitted, source({
      picking: [shipping], receiving: [receipt(4, ReceivingTaskStatus.OPEN)], trips: [route(4, TripStatus.LOADED)],
    }));

    expect(project(replayed).yardVisits?.size).toBe(0);
  });
});
