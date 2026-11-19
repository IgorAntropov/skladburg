import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { Page } from '@playwright/test';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  DealDeadlinesSchema,
  DealSchema,
  DealStatus,
  DealTransitionSchema,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentSchema,
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import {
  TripRecordSchema,
  TripStatus,
} from '@skladburg/contracts/logistics/v1/trip_records';
import {
  WarehouseCapability,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  SafeDealPaymentRecordSchema,
  SafeDealPaymentStatus,
} from '@skladburg/contracts/payment/v1/payment';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  WarehouseFloorRectSchema,
  WarehouseTopologySchema,
  WarehouseUnloadingPointSchema,
} from '@skladburg/contracts/wms/v1/topology';

const DATABASE_NAME = 'skladburg-demo-engine';
const CARRIER_ORGANIZATION_ID = '10000004-0000-4000-8000-000000000000';
const CARRIER_USER_ID = '20000004-0000-4000-8000-000000000000';
const DOCK_SPACING_MM = 6_400;
const DOCK_LEFT_MM = 1_000;
const SCALED_ARRIVAL_START_MS = Date.UTC(2026, 9, 6, 8);
const NEXT_ARRIVAL_AT_MS = Date.UTC(2026, 9, 12, 10);

export interface ScaledDockAssignmentValue {
  dockId: string;
  dockNumber: number;
  parkingIndex: number;
  releaseTaskId: string;
  taskId: string;
}

export interface ScaledDockFixtureValue {
  assignments: readonly ScaledDockAssignmentValue[];
  dockIds: readonly string[];
  neighborId: string | undefined;
  nextArrivalId: string | undefined;
  waitingIds: readonly string[];
}

export type ScaledDockScenarioValue = 20 | 25 | 30 | 'capacity';

export interface SixDockFixtureValue {
  dockIds: readonly string[];
  frontId: string;
  middleId: string;
  neighborId: string;
  rearId: string;
  releaseFarId: string;
  releaseMiddleId: string;
}

export interface YardSceneDispatchFixtureValue {
  dockId: string;
  taskId: string;
  visitCount: number;
}

interface SixDockDeliveryValue {
  deal: Deal;
  task: ReceivingTask;
}

interface StoredSeedPutValue {
  bytes: number[];
  id: string;
  table: 'deals' | 'documents' | 'payments' | 'trips' | 'warehouseInbound' | 'warehouses' | 'warehouseTopologies';
}

const fixtureId = (number: number): string => `ff910000-0000-4000-8000-${String(number).padStart(12, '0')}`;

const reachedAt = (deal: Deal): Timestamp | undefined => deal.transitions.find(transition => transition.to === DealStatus.ARRIVED)?.at;

const writeFixture = async (
  page: Page,
  puts: readonly StoredSeedPutValue[],
  tenantId: string,
  warehouseId: string,
): Promise<void> => page.evaluate(async ({ databaseName, puts, tenantId, warehouseId }): Promise<void> => {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = (): void => {
      resolve(request.result);
    };
    request.onerror = (): void => {
      reject(request.error ?? new Error('Could not open the warehouse fixture database'));
    };
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([...new Set(puts.map(put => put.table))], 'readwrite');
      transaction.oncomplete = (): void => {
        resolve();
      };
      transaction.onabort = (): void => {
        reject(transaction.error ?? new Error('Could not store the six-dock yard'));
      };
      for (const { bytes: data, id, table } of puts) {
        const bytes = Uint8Array.from(data);
        const stored = table === 'warehouseInbound'
          ? { bytes, id, lookupKey: tenantId, scopeId: warehouseId }
          : table === 'warehouseTopologies' ? { id, topologyBytes: bytes } : bytes;
        transaction.objectStore(table).put(stored, id);
      }
    });
  }
  finally {
    database.close();
  }
}, { databaseName: DATABASE_NAME, puts, tenantId, warehouseId });

const createFixtureDelivery = (
  source: SixDockDeliveryValue,
  number: number,
  yardAdmissionStatus: YardAdmissionStatus,
  unloadingPointId: string | undefined,
  deliveryMethod = source.deal.deliveryMethod,
): SixDockDeliveryValue => {
  const id = fixtureId(number);
  return {
    deal: create(DealSchema, { ...source.deal, deliveryMethod, id }),
    task: create(ReceivingTaskSchema, {
      ...source.task,
      dealId: id,
      expectedUnits: source.task.expectedUnits.map((unit, index) => ({
        ...unit, id: fixtureId(number + 100 * (index + 1)), sscc: undefined,
      })),
      id,
      unloadingPointId,
      updDocumentId: fixtureId(number + 30),
      yardAdmissionStatus,
    }),
  };
};

const fixtureDeliveryPuts = ({ deal, task }: SixDockDeliveryValue): StoredSeedPutValue[] => {
  const id = task.updDocumentId ?? '';
  const upd = create(DocumentSchema, {
    content: { terms: { case: 'upd', value: { lines: task.orderLines.map(({ dealLineId, productName, quantityBase }) => ({
      dealLineId, productName, quantityBase,
    })) } } },
    dealId: deal.id,
    displayNumber: `ДВОР-${id.slice(-2)}`,
    id,
    issuerOrganizationId: deal.supplierOrganizationId,
    status: DocumentStatus.APPROVED,
    type: DocumentType.UPD,
    version: 1,
  });
  return [
    { bytes: Array.from(toBinary(DealSchema, deal)), id: deal.id, table: 'deals' },
    { bytes: Array.from(toBinary(DocumentSchema, upd)), id, table: 'documents' },
  ];
};

const fixtureTripPut = (
  number: number,
  deal: Deal,
  cargoKind: VehicleCargoKind,
  isWaitingForTitle = false,
  arrivalAt = reachedAt(deal),
  titleSubmittedAt?: Timestamp,
): StoredSeedPutValue => {
  const id = fixtureId(number);
  const arrivedAt = arrivalAt;
  const trip = create(TripRecordSchema, {
    arrivedAt,
    assignment: { arrivalAt: arrivedAt, driverId: fixtureId(number + 200), registrationNumber: 'ДЕМО', vehicleId: fixtureId(number + 300) },
    carrierTitle: titleSubmittedAt === undefined
      ? isWaitingForTitle ? {} : undefined
      : { submittedAt: titleSubmittedAt, submittedByUserId: CARRIER_USER_ID },
    customerOrganizationId: deal.customerOrganizationId,
    dealId: deal.id,
    id,
    status: TripStatus.ARRIVED,
    supplierOrganizationId: deal.supplierOrganizationId,
    transportOrder: {
      cargo: { cargoKind },
      carrierOrganizationId: CARRIER_ORGANIZATION_ID,
      confirmedAt: arrivedAt,
      delivery: { organizationId: deal.customerOrganizationId, warehouseId: deal.shipToWarehouseId },
      shipperOrganizationId: deal.customerOrganizationId,
    },
    version: 1,
  });
  return { bytes: Array.from(toBinary(TripRecordSchema, trip)), id, table: 'trips' };
};

const createWideDockTopology = (topology: WarehouseTopology): WarehouseTopology => {
  const area = topology.receivingArea;
  const d01 = area?.unloadingPoint;
  const d02 = area?.additionalUnloadingPoints[0];
  if (area === undefined || d01 === undefined || d02 === undefined) {
    throw new Error('Kazan must have both original docks');
  }
  const positions = [undefined, undefined, undefined, WarehouseCapability.OVERSIZE, undefined, WarehouseCapability.COLD];
  const docks = positions.map((capability, index) => create(WarehouseUnloadingPointSchema, {
    capabilities: capability === undefined ? [WarehouseCapability.RAMP] : [WarehouseCapability.RAMP, capability],
    code: `D0${String(index + 1)}`,
    id: index === 0 ? d01.id : index === 1 ? d02.id : fixtureId(index + 1),
    position: { xMm: DOCK_LEFT_MM + index * DOCK_SPACING_MM, zMm: 0 },
  }));
  return create(WarehouseTopologySchema, {
    ...topology,
    receivingArea: {
      ...area,
      additionalUnloadingPoints: docks.slice(1),
      footprint: create(WarehouseFloorRectSchema, { depthMm: 3_000, origin: { xMm: DOCK_LEFT_MM, zMm: 2_100 }, widthMm: 34_000 }),
      unloadingPoint: docks[0],
    },
    revision: topology.revision + 1,
  });
};

const commitFixture = async (
  page: Page,
  warehouse: Warehouse,
  topology: WarehouseTopology,
  tasks: readonly ReceivingTask[],
  puts: readonly StoredSeedPutValue[],
): Promise<void> => {
  const wideWarehouse = create(WarehouseSchema, {
    ...warehouse, capabilities: [WarehouseCapability.RAMP, WarehouseCapability.COLD, WarehouseCapability.OVERSIZE],
  });
  await writeFixture(page, [
    { bytes: Array.from(toBinary(WarehouseTopologySchema, topology)), id: warehouse.id, table: 'warehouseTopologies' },
    { bytes: Array.from(toBinary(WarehouseSchema, wideWarehouse)), id: warehouse.id, table: 'warehouses' },
    ...puts,
    ...tasks.map((task): StoredSeedPutValue => ({
      bytes: Array.from(toBinary(ReceivingTaskSchema, task)), id: task.id, table: 'warehouseInbound',
    })),
  ], warehouse.tenantId, warehouse.id);
};

export const storeSixDockWarehouse = async (
  page: Page,
  topology: WarehouseTopology,
  warehouse: Warehouse,
  deliveries: readonly SixDockDeliveryValue[],
): Promise<SixDockFixtureValue> => {
  const [neighbor, far, rear] = deliveries;
  const wideTopology = createWideDockTopology(topology);
  const area = wideTopology.receivingArea;
  const [d04, d05, d06] = area?.additionalUnloadingPoints.slice(2) ?? [];
  if (neighbor === undefined || far === undefined || rear === undefined || area?.unloadingPoint === undefined
    || d04 === undefined || d05 === undefined || d06 === undefined) {
    throw new Error('The six-dock scenario needs the three seeded Kazan arrivals');
  }

  const front = createFixtureDelivery(neighbor, 10, YardAdmissionStatus.WAITING_DOCUMENTS, undefined, DeliveryMethod.EXCHANGE);
  const middle = createFixtureDelivery(far, 11, YardAdmissionStatus.WAITING_DOCK, undefined);
  const releaseMiddle = createFixtureDelivery(far, 12, YardAdmissionStatus.ADMITTED, d04.id);
  const tasks = [
    create(ReceivingTaskSchema, { ...neighbor.task, unloadingPointId: d05.id, yardAdmissionStatus: YardAdmissionStatus.ADMITTED }),
    create(ReceivingTaskSchema, { ...far.task, unloadingPointId: d06.id, yardAdmissionStatus: YardAdmissionStatus.ADMITTED }),
    create(ReceivingTaskSchema, { ...rear.task, unloadingPointId: undefined, yardAdmissionStatus: YardAdmissionStatus.WAITING_DOCK }),
    front.task,
    middle.task,
    releaseMiddle.task,
  ];
  await commitFixture(page, warehouse, wideTopology, tasks, [
    ...[front, middle, releaseMiddle].flatMap(fixtureDeliveryPuts),
    fixtureTripPut(20, front.deal, VehicleCargoKind.GENERAL, true),
    fixtureTripPut(21, middle.deal, VehicleCargoKind.OVERSIZE),
    fixtureTripPut(22, rear.deal, VehicleCargoKind.TEMPERATURE_CONTROLLED),
  ]);

  return {
    dockIds: [area.unloadingPoint, ...area.additionalUnloadingPoints].map(dock => dock.id),
    frontId: front.task.id,
    middleId: middle.task.id,
    neighborId: neighbor.task.id,
    rearId: rear.task.id,
    releaseFarId: far.task.id,
    releaseMiddleId: releaseMiddle.task.id,
  };
};

const giveArrivalTime = (delivery: SixDockDeliveryValue, arrivedAtMs: number): SixDockDeliveryValue => ({
  ...delivery,
  deal: create(DealSchema, {
    ...delivery.deal,
    transitions: delivery.deal.transitions.map(transition => transition.to === DealStatus.ARRIVED
      ? create(DealTransitionSchema, { ...transition, at: timestampFromMs(arrivedAtMs) })
      : transition),
  }),
});

const createNextArrival = (source: SixDockDeliveryValue): SixDockDeliveryValue => {
  const delivery = createFixtureDelivery(source, 1_499, YardAdmissionStatus.UNSPECIFIED, undefined);
  return {
    deal: create(DealSchema, {
      ...delivery.deal,
      deadlines: create(DealDeadlinesSchema, { arrivalDueAt: timestampFromMs(NEXT_ARRIVAL_AT_MS) }),
      status: DealStatus.IN_TRANSIT,
      transitions: delivery.deal.transitions.filter(transition => transition.to !== DealStatus.ARRIVED),
    }),
    task: create(ReceivingTaskSchema, { ...delivery.task, status: ReceivingTaskStatus.UNSPECIFIED, version: 0 }),
  };
};

const fixturePaymentPut = ({ id }: Deal): StoredSeedPutValue => {
  const payment = create(SafeDealPaymentRecordSchema, { id, payment: { dealId: id, status: SafeDealPaymentStatus.HELD, version: 1 } });
  return { bytes: Array.from(toBinary(SafeDealPaymentRecordSchema, payment)), id, table: 'payments' };
};

export const storeYardSceneDispatchQueue = async (
  page: Page,
  topology: WarehouseTopology,
  warehouse: Warehouse,
  deliveries: readonly SixDockDeliveryValue[],
  visitCount: 25 | 30 = 25,
): Promise<YardSceneDispatchFixtureValue> => {
  const [sample] = deliveries;
  const wideTopology = createWideDockTopology(topology);
  const coldDock = wideTopology.receivingArea?.additionalUnloadingPoints[4];
  if (sample === undefined || coldDock === undefined) {
    throw new Error('The dispatcher scene needs a seeded receipt and dock D06');
  }

  const source = {
    ...sample,
    task: create(ReceivingTaskSchema, {
      ...sample.task, assigneeUserId: undefined, dockSchedule: undefined, receivedUnits: [], status: ReceivingTaskStatus.OPEN, version: 1,
    }),
  };
  const arrivalAtMs = SCALED_ARRIVAL_START_MS;
  const submittedAt = timestampFromMs(arrivalAtMs);
  const visits = Array.from({ length: visitCount }, (_unused, index) => {
    const status = index === 0 ? YardAdmissionStatus.WAITING_DOCK : YardAdmissionStatus.WAITING_DOCUMENTS;
    const delivery = createFixtureDelivery(source, 1_500 + index, status, undefined, DeliveryMethod.EXCHANGE);
    return giveArrivalTime(delivery, arrivalAtMs + index * 60_000);
  });
  const [ready] = visits;
  if (ready?.task.updDocumentId === undefined) {
    throw new Error('The first parked truck needs an approved invoice');
  }
  const dispatchTitle = create(DocumentSchema, {
    content: { terms: {
      case: 'dispatchTitle',
      value: { shippedAt: timestampFromMs(arrivalAtMs - 30 * 60_000), updDocumentId: ready.task.updDocumentId },
    } },
    dealId: ready.deal.id,
    displayNumber: 'ДВОР-ОТГРУЗКА-1',
    id: fixtureId(1_950),
    issuerOrganizationId: ready.deal.supplierOrganizationId,
    status: DocumentStatus.APPROVED,
    type: DocumentType.DISPATCH_TITLE,
    version: 1,
  });
  const hidden = deliveries.map(({ task }) => create(ReceivingTaskSchema, {
    ...task, status: ReceivingTaskStatus.UNSPECIFIED, unloadingPointId: undefined, version: 0,
  }));
  const blockedTrips = visits.slice(1).map(({ deal }, index) => fixtureTripPut(4_501 + index, deal, VehicleCargoKind.GENERAL, true));
  await commitFixture(page, warehouse, wideTopology, [...hidden, ...visits.map(({ task }) => task)], [
    ...visits.flatMap(fixtureDeliveryPuts),
    ...blockedTrips,
    fixtureTripPut(4_500, ready.deal, VehicleCargoKind.TEMPERATURE_CONTROLLED, false, submittedAt, submittedAt),
    { bytes: Array.from(toBinary(DocumentSchema, dispatchTitle)), id: dispatchTitle.id, table: 'documents' },
  ]);
  return { dockId: coldDock.id, taskId: ready.task.id, visitCount };
};

export const storeScaledDockWarehouse = async (
  page: Page,
  topology: WarehouseTopology,
  warehouse: Warehouse,
  deliveries: readonly SixDockDeliveryValue[],
  scenario: ScaledDockScenarioValue,
): Promise<ScaledDockFixtureValue> => {
  const [neighbor, far, source] = deliveries;
  const wideTopology = createWideDockTopology(topology);
  const area = wideTopology.receivingArea;
  const [d04, d05, d06] = area?.additionalUnloadingPoints.slice(2) ?? [];
  if (neighbor === undefined || far === undefined || source === undefined || area?.unloadingPoint === undefined
    || d04 === undefined || d05 === undefined || d06 === undefined) {
    throw new Error('The scaled yard requires the three Kazan warehouse receipts');
  }
  const placements = scenario === 'capacity'
    ? []
    : scenario === 30
      ? [{ cargo: VehicleCargoKind.OVERSIZE, dock: d04, parkingIndex: 5 },
          { cargo: VehicleCargoKind.TEMPERATURE_CONTROLLED, dock: d06, parkingIndex: 26 }]
      : [{ cargo: VehicleCargoKind.TEMPERATURE_CONTROLLED, dock: d06, parkingIndex: scenario === 20 ? 0 : 21 }];
  const docked = scenario === 'capacity'
    ? []
    : [
        create(ReceivingTaskSchema, { ...neighbor.task, unloadingPointId: d05.id, yardAdmissionStatus: YardAdmissionStatus.ADMITTED }),
        create(ReceivingTaskSchema, { ...far.task, unloadingPointId: d06.id, yardAdmissionStatus: YardAdmissionStatus.ADMITTED }),
        ...(scenario === 30
          ? [create(ReceivingTaskSchema, { ...source.task, unloadingPointId: d04.id, yardAdmissionStatus: YardAdmissionStatus.ADMITTED })]
          : []),
      ];
  const hidden = deliveries.filter(({ task }) => !docked.some(candidate => candidate.id === task.id)).map(({ task }) =>
    create(ReceivingTaskSchema, { ...task, status: ReceivingTaskStatus.UNSPECIFIED, unloadingPointId: undefined, version: 0 }));
  const parkingCount = scenario === 'capacity' ? 30 : scenario - docked.length;
  const waiting = Array.from({ length: parkingCount }, (_unused, index) => {
    const target = placements.find(placement => placement.parkingIndex === index);
    const status = target === undefined ? YardAdmissionStatus.WAITING_DOCUMENTS : YardAdmissionStatus.WAITING_DOCK;
    const method = target === undefined ? DeliveryMethod.EXCHANGE : DeliveryMethod.CUSTOMER;
    const delivery = createFixtureDelivery(source, 1_000 + index, status, undefined, method);
    return giveArrivalTime(delivery, SCALED_ARRIVAL_START_MS + index * 60_000);
  });
  const assignments = placements.map(({ dock, parkingIndex }): ScaledDockAssignmentValue => {
    const target = waiting[parkingIndex];
    const isFar = dock.id === d06.id;
    if (target === undefined) {
      throw new Error(`No seeded visit for parking index ${String(parkingIndex)}`);
    }
    return { dockId: dock.id, dockNumber: isFar ? 6 : 4, parkingIndex, releaseTaskId: isFar ? far.task.id : source.task.id,
      taskId: target.task.id };
  });
  const next = scenario === 20 ? createNextArrival(source) : undefined;
  const tasks = [...docked, ...hidden, ...waiting.map(({ task }) => task), ...(next === undefined ? [] : [next.task])];
  await commitFixture(page, warehouse, wideTopology, tasks, [
    ...waiting.flatMap(fixtureDeliveryPuts),
    ...waiting.map(({ deal }, index) => {
      const target = placements.find(placement => placement.parkingIndex === index);
      return fixtureTripPut(4_000 + index, deal, target?.cargo ?? VehicleCargoKind.GENERAL, target === undefined);
    }),
    ...(next === undefined
      ? []
      : [
          ...fixtureDeliveryPuts(next), fixturePaymentPut(next.deal),
          fixtureTripPut(4_099, next.deal, VehicleCargoKind.TEMPERATURE_CONTROLLED, false, timestampFromMs(NEXT_ARRIVAL_AT_MS)),
        ]),
  ]);
  return {
    assignments,
    dockIds: [area.unloadingPoint, ...area.additionalUnloadingPoints].map(dock => dock.id),
    neighborId: scenario === 'capacity' ? undefined : neighbor.task.id,
    nextArrivalId: next?.task.id,
    waitingIds: waiting.map(({ task }) => task.id),
  };
};
