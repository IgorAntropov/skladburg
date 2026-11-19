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
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  DealSchema,
  DealStatus,
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
  ReceivingTaskSchema,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  WarehouseFloorRectSchema,
  WarehouseTopologySchema,
  WarehouseUnloadingPointSchema,
} from '@skladburg/contracts/wms/v1/topology';

const DATABASE_NAME = 'skladburg-demo-engine';
const CARRIER_ORGANIZATION_ID = '10000004-0000-4000-8000-000000000000';
const DOCK_SPACING_MM = 6_400;
const DOCK_LEFT_MM = 1_000;

export interface SixDockFixtureValue {
  dockIds: readonly string[];
  frontId: string;
  middleId: string;
  neighborId: string;
  rearId: string;
  releaseFarId: string;
  releaseMiddleId: string;
}

interface SixDockDeliveryValue {
  deal: Deal;
  task: ReceivingTask;
}

interface StoredSeedPutValue {
  bytes: number[];
  id: string;
  table: 'deals' | 'documents' | 'trips' | 'warehouseInbound' | 'warehouses' | 'warehouseTopologies';
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

const fixtureTripPut = (number: number, deal: Deal, cargoKind: VehicleCargoKind, isWaitingForTitle = false): StoredSeedPutValue => {
  const id = fixtureId(number);
  const arrivedAt = reachedAt(deal);
  const trip = create(TripRecordSchema, {
    arrivedAt,
    assignment: { arrivalAt: arrivedAt, driverId: fixtureId(number + 200), registrationNumber: 'ДЕМО', vehicleId: fixtureId(number + 300) },
    carrierTitle: isWaitingForTitle ? {} : undefined,
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

export const storeSixDockWarehouse = async (
  page: Page,
  topology: WarehouseTopology,
  warehouse: Warehouse,
  deliveries: readonly SixDockDeliveryValue[],
): Promise<SixDockFixtureValue> => {
  const [neighbor, far, rear] = deliveries;
  const area = topology.receivingArea;
  const d01 = area?.unloadingPoint;
  const d02 = area?.additionalUnloadingPoints[0];
  if (neighbor === undefined || far === undefined || rear === undefined || area === undefined || d01 === undefined || d02 === undefined) {
    throw new Error('The six-dock scenario needs the three seeded Kazan arrivals and both original docks');
  }

  const positions = [undefined, undefined, undefined, WarehouseCapability.OVERSIZE, undefined, WarehouseCapability.COLD];
  const docks = positions.map((capability, index) => create(WarehouseUnloadingPointSchema, {
    capabilities: capability === undefined ? [WarehouseCapability.RAMP] : [WarehouseCapability.RAMP, capability],
    code: `D0${String(index + 1)}`,
    id: index === 0 ? d01.id : index === 1 ? d02.id : fixtureId(index + 1),
    position: { xMm: DOCK_LEFT_MM + index * DOCK_SPACING_MM, zMm: 0 },
  }));
  const [primary, , , d04, d05, d06] = docks;
  if (primary === undefined || d04 === undefined || d05 === undefined || d06 === undefined) {
    throw new Error('Missing a dock required by the six-dock scenario');
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
  const wideTopology = create(WarehouseTopologySchema, {
    ...topology,
    receivingArea: {
      ...area,
      additionalUnloadingPoints: docks.slice(1),
      footprint: create(WarehouseFloorRectSchema, { depthMm: 3_000, origin: { xMm: DOCK_LEFT_MM, zMm: 2_100 }, widthMm: 34_000 }),
      unloadingPoint: primary,
    },
    revision: topology.revision + 1,
  });
  const wideWarehouse = create(WarehouseSchema, {
    ...warehouse, capabilities: [WarehouseCapability.RAMP, WarehouseCapability.COLD, WarehouseCapability.OVERSIZE],
  });
  const puts: StoredSeedPutValue[] = [
    { bytes: Array.from(toBinary(WarehouseTopologySchema, wideTopology)), id: warehouse.id, table: 'warehouseTopologies' },
    { bytes: Array.from(toBinary(WarehouseSchema, wideWarehouse)), id: warehouse.id, table: 'warehouses' },
    ...[front, middle, releaseMiddle].flatMap(fixtureDeliveryPuts),
    fixtureTripPut(20, front.deal, VehicleCargoKind.GENERAL, true),
    fixtureTripPut(21, middle.deal, VehicleCargoKind.OVERSIZE),
    fixtureTripPut(22, rear.deal, VehicleCargoKind.TEMPERATURE_CONTROLLED),
    ...tasks.map((task): StoredSeedPutValue => ({
      bytes: Array.from(toBinary(ReceivingTaskSchema, task)), id: task.id, table: 'warehouseInbound',
    })),
  ];
  await writeFixture(page, puts, warehouse.tenantId, warehouse.id);

  return {
    dockIds: docks.map(dock => dock.id),
    frontId: front.task.id,
    middleId: middle.task.id,
    neighborId: neighbor.task.id,
    rearId: rear.task.id,
    releaseFarId: far.task.id,
    releaseMiddleId: releaseMiddle.task.id,
  };
};
