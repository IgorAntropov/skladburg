import type { Page } from '@playwright/test';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
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
  ReceivingDockScheduleSchema,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';

const DATABASE_NAME = 'skladburg-demo-engine';
const WAREHOUSE_ID = '80000001-0000-4000-8000-000000000000';
const ARRIVED_AT_MS = Date.UTC(2026, 9, 12, 5, 59);
const SHIPPED_AT_MS = Date.UTC(2026, 9, 12, 5, 29);

const fixtureId = (number: number): string => `ff920000-0000-4000-8000-${String(number).padStart(12, '0')}`;

export const DOCK_SLOT_ARRIVAL = {
  carrierOrganizationId: '10000004-0000-4000-8000-000000000000',
  carrierUserId: '20000004-0000-4000-8000-000000000000',
  dealId: fixtureId(1),
  startsAtMs: Date.UTC(2026, 9, 12, 6, 2),
  tripId: fixtureId(2),
  warehouseId: WAREHOUSE_ID,
} as const;

export const storeDockSlotArrival = async (
  page: Page,
  sourceDeal: Deal,
  sourceTask: ReceivingTask,
  receivingAreaId: string,
): Promise<void> => {
  const { carrierOrganizationId, dealId, startsAtMs, tripId, warehouseId } = DOCK_SLOT_ARRIVAL;
  const { customerOrganizationId, shipFromWarehouseId, supplierOrganizationId } = sourceDeal;
  const arrivedAt = timestampFromMs(ARRIVED_AT_MS);
  const preferredStartsAt = timestampFromMs(startsAtMs);
  const shippedAt = timestampFromMs(SHIPPED_AT_MS);
  const updDocumentId = fixtureId(3);
  const dispatchTitleId = fixtureId(4);
  const deal = create(DealSchema, {
    ...sourceDeal,
    deliveryMethod: DeliveryMethod.EXCHANGE,
    id: dealId,
    shipToWarehouseId: warehouseId,
    status: DealStatus.ARRIVED,
    transitions: [create(DealTransitionSchema, { at: arrivedAt, from: DealStatus.IN_TRANSIT, to: DealStatus.ARRIVED })],
  });
  const trip = create(TripRecordSchema, {
    arrivedAt,
    assignment: {
      arrivalAt: preferredStartsAt,
      departureAt: shippedAt,
      driverId: fixtureId(5),
      registrationNumber: 'ДЕМО',
      vehicleId: fixtureId(6),
    },
    carrierTitle: {},
    customerOrganizationId,
    dealId,
    departedAt: shippedAt,
    id: tripId,
    status: TripStatus.ARRIVED,
    supplierOrganizationId,
    transportOrder: {
      cargo: { cargoKind: VehicleCargoKind.GENERAL },
      carrierOrganizationId,
      confirmedAt: shippedAt,
      delivery: { organizationId: customerOrganizationId, warehouseId },
      deliveryWindow: { endsAt: timestampFromMs(startsAtMs + 60 * 60_000), startsAt: preferredStartsAt },
      pickup: { organizationId: supplierOrganizationId, warehouseId: shipFromWarehouseId },
      shipperOrganizationId: customerOrganizationId,
    },
    version: 1,
  });
  const upd = create(DocumentSchema, {
    content: { terms: { case: 'upd', value: { lines: sourceTask.orderLines.map(({ dealLineId, productName, quantityBase }) => ({
      dealLineId, productName, quantityBase,
    })) } } },
    dealId,
    displayNumber: 'УПД-ДЕМО-74',
    id: updDocumentId,
    issuerOrganizationId: supplierOrganizationId,
    status: DocumentStatus.APPROVED,
    type: DocumentType.UPD,
    version: 1,
  });
  const dispatchTitle = create(DocumentSchema, {
    content: { terms: { case: 'dispatchTitle', value: { shippedAt, updDocumentId } } },
    dealId,
    displayNumber: 'ОТГРУЗКА-ДЕМО-74',
    id: dispatchTitleId,
    issuerOrganizationId: supplierOrganizationId,
    status: DocumentStatus.APPROVED,
    type: DocumentType.DISPATCH_TITLE,
    version: 1,
  });
  const task = create(ReceivingTaskSchema, {
    ...sourceTask,
    assigneeUserId: undefined,
    dealId,
    dockSchedule: create(ReceivingDockScheduleSchema, { preferredStartsAt }),
    expectedUnits: sourceTask.expectedUnits.map((unit, index) => ({ ...unit, id: fixtureId(10 + index) })),
    id: dealId,
    receivedUnits: [],
    receivingAreaId,
    sourceDocumentNumber: upd.displayNumber,
    status: ReceivingTaskStatus.OPEN,
    unloadingPointId: undefined,
    updDocumentId,
    version: 1,
    warehouseId,
    yardAdmissionStatus: YardAdmissionStatus.WAITING_DOCUMENTS,
  });

  const puts = [
    { bytes: Array.from(toBinary(DealSchema, deal)), id: deal.id, table: 'deals' },
    { bytes: Array.from(toBinary(TripRecordSchema, trip)), id: trip.id, table: 'trips' },
    { bytes: Array.from(toBinary(DocumentSchema, upd)), id: upd.id, table: 'documents' },
    { bytes: Array.from(toBinary(DocumentSchema, dispatchTitle)), id: dispatchTitle.id, table: 'documents' },
    { bytes: Array.from(toBinary(ReceivingTaskSchema, task)), id: task.id, table: 'warehouseInbound' },
  ];

  await page.evaluate(async ({ databaseName, puts, tenantId, warehouseId }): Promise<void> => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = (): void => {
        resolve(request.result);
      };
      request.onerror = (): void => {
        reject(request.error ?? new Error('Could not open the demo world'));
      };
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['deals', 'trips', 'documents', 'warehouseInbound'], 'readwrite');
        transaction.oncomplete = (): void => {
          resolve();
        };
        transaction.onabort = (): void => {
          reject(transaction.error ?? new Error('Could not store the demo arrival'));
        };
        for (const { bytes, id, table } of puts) {
          const stored = Uint8Array.from(bytes);
          transaction.objectStore(table).put(
            table === 'warehouseInbound' ? { bytes: stored, id, lookupKey: tenantId, scopeId: warehouseId } : stored,
            id,
          );
        }
      });
    }
    finally {
      db.close();
    }
  }, { databaseName: DATABASE_NAME, puts, tenantId: customerOrganizationId, warehouseId });
};
