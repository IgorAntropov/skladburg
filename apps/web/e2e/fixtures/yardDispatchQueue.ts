import type { Page } from '@playwright/test';
import type { WarehouseUnloadingPoint } from '@skladburg/contracts/wms/v1/topology';

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
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';

import {
  readQueueSeed,
  YARD_POLICY_QUEUE,
} from './yardPolicyQueue.ts';

const DATABASE_NAME = 'skladburg-demo-engine';
const CARRIER_ORGANIZATION = '10000004-0000-4000-8000-000000000000';
const CARRIER_USER = '20000004-0000-4000-8000-000000000000';
const SHIPPING_MS = Date.UTC(2026, 9, 12, 4, 30);
const ARRIVAL_MS = Date.UTC(2026, 9, 12, 5, 20);
const MINUTE_MS = 60_000;

const fixtureId = (index: number): string => `ff940000-0000-4000-8000-${String(index).padStart(12, '0')}`;

export const YARD_DISPATCH_QUEUE = {
  taskIds: [fixtureId(1), fixtureId(2)],
  warehouseId: YARD_POLICY_QUEUE.warehouseId,
} as const;

export const storeYardDispatchQueue = async (page: Page): Promise<WarehouseUnloadingPoint> => {
  const seed = await readQueueSeed(page);
  const { customerOrganizationId, shipFromWarehouseId, supplierOrganizationId } = seed.deal;
  const { taskIds, warehouseId } = YARD_DISPATCH_QUEUE;
  const shippedAt = timestampFromMs(SHIPPING_MS);
  const puts = taskIds.flatMap((id, index) => {
    const arrivedAt = timestampFromMs(ARRIVAL_MS + index * 10 * MINUTE_MS);
    const updDocumentId = fixtureId(10 + index);
    const deal = create(DealSchema, {
      ...seed.deal,
      deliveryMethod: DeliveryMethod.EXCHANGE,
      id,
      shipToWarehouseId: warehouseId,
      status: DealStatus.ARRIVED,
      transitions: [create(DealTransitionSchema, { at: arrivedAt, from: DealStatus.IN_TRANSIT, to: DealStatus.ARRIVED })],
    });
    const trip = create(TripRecordSchema, {
      arrivedAt,
      assignment: {
        arrivalAt: arrivedAt,
        departureAt: shippedAt,
        driverId: fixtureId(50 + index),
        registrationNumber: `ДЕМО-${String(index + 1)}`,
        vehicleId: fixtureId(60 + index),
      },
      carrierTitle: { submittedAt: arrivedAt, submittedByUserId: CARRIER_USER },
      customerOrganizationId,
      dealId: id,
      departedAt: shippedAt,
      id: fixtureId(30 + index),
      status: TripStatus.ARRIVED,
      supplierOrganizationId,
      transportOrder: {
        cargo: { cargoKind: VehicleCargoKind.GENERAL },
        carrierOrganizationId: CARRIER_ORGANIZATION,
        confirmedAt: shippedAt,
        delivery: { organizationId: customerOrganizationId, warehouseId },
        pickup: { organizationId: supplierOrganizationId, warehouseId: shipFromWarehouseId },
        shipperOrganizationId: customerOrganizationId,
      },
      version: 1,
    });
    const upd = create(DocumentSchema, {
      content: { terms: { case: 'upd', value: { lines: seed.task.orderLines.map(({ dealLineId, productName, quantityBase }) => ({
        dealLineId, productName, quantityBase,
      })) } } },
      dealId: id,
      displayNumber: `УПД-ДИСПЕТЧЕР-${String(index + 1)}`,
      id: updDocumentId,
      issuerOrganizationId: supplierOrganizationId,
      status: DocumentStatus.APPROVED,
      type: DocumentType.UPD,
      version: 1,
    });
    const dispatchTitle = create(DocumentSchema, {
      content: { terms: { case: 'dispatchTitle', value: { shippedAt, updDocumentId } } },
      dealId: id,
      displayNumber: `ОТГРУЗКА-ДИСПЕТЧЕР-${String(index + 1)}`,
      id: fixtureId(20 + index),
      issuerOrganizationId: supplierOrganizationId,
      status: DocumentStatus.APPROVED,
      type: DocumentType.DISPATCH_TITLE,
      version: 1,
    });
    const task = create(ReceivingTaskSchema, {
      ...seed.task,
      assigneeUserId: undefined,
      dealId: id,
      dockSchedule: undefined,
      expectedUnits: seed.task.expectedUnits.map((unit, unitIndex) => ({ ...unit, id: fixtureId(100 + 10 * index + unitIndex) })),
      id,
      receivedUnits: [],
      receivingAreaId: seed.areaId,
      sourceDocumentNumber: upd.displayNumber,
      status: ReceivingTaskStatus.OPEN,
      unloadingPointId: undefined,
      updDocumentId,
      version: 1,
      warehouseId,
      yardAdmissionStatus: YardAdmissionStatus.WAITING_DOCK,
    });

    return [
      { bytes: Array.from(toBinary(DealSchema, deal)), id: deal.id, table: 'deals' },
      { bytes: Array.from(toBinary(TripRecordSchema, trip)), id: trip.id, table: 'trips' },
      { bytes: Array.from(toBinary(DocumentSchema, upd)), id: upd.id, table: 'documents' },
      { bytes: Array.from(toBinary(DocumentSchema, dispatchTitle)), id: dispatchTitle.id, table: 'documents' },
      { bytes: Array.from(toBinary(ReceivingTaskSchema, task)), id: task.id, table: 'warehouseInbound' },
    ];
  });

  await page.evaluate(async ({ databaseName, puts, tenantId, warehouseId }): Promise<void> => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
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
        const transaction = database.transaction(['deals', 'documents', 'trips', 'warehouseInbound'], 'readwrite');
        transaction.oncomplete = (): void => {
          resolve();
        };
        transaction.onabort = (): void => {
          reject(transaction.error ?? new Error('Could not store the waiting dispatch visits'));
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
      database.close();
    }
  }, { databaseName: DATABASE_NAME, puts, tenantId: customerOrganizationId, warehouseId });

  return seed.dock;
};
