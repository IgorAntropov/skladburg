import type {
  DescMessage,
  DescMethodUnary,
  MessageInitShape,
  MessageShape,
} from '@bufbuild/protobuf';
import type { Page } from '@playwright/test';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type { WarehouseUnloadingPoint } from '@skladburg/contracts/wms/v1/topology';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { MembershipSchema } from '@skladburg/contracts/access/v1/access';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import {
  DealSchema,
  DealService,
  DealStatus,
  DealTransitionSchema,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentSchema,
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  WarehouseReceivingService,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';

import type { EngineWorkerRobotValue } from '../robots/engine-worker-robot.ts';

import { DEAL_CUSTOMER } from '../robots/deal-worker-robot.ts';
import { changeStoredEngineMetadata } from '../robots/engine-storage-robot.ts';
import { createEngineWorkerRobot } from '../robots/engine-worker-robot.ts';
import { OWN_NETWORK_SITES } from './demoData.ts';
import { storeDockSlotArrival } from './dockSlotArrival.ts';
import { expect } from './test.ts';

interface QueueRecordValue {
  bytes: number[];
  id: string;
  table: string;
}

interface QueueVisitValue {
  arrivedAtMs: number;
  dealId: string;
  isDocked: boolean;
  isUrgent: boolean;
  requiredQualifications?: readonly WarehouseStaffQualificationKind[] | undefined;
}

interface YardPolicyQueueSeedValue {
  areaId: string;
  deal: Deal;
  dock: WarehouseUnloadingPoint;
  task: ReceivingTask;
}

const KAZAN_SCOPE = { warehouseId: OWN_NETWORK_SITES[2].id };
const DATABASE_NAME = 'skladburg-demo-engine';
const fixtureId = (index: number): string => `ff930000-0000-4000-8000-${String(index).padStart(12, '0')}`;

export const YARD_POLICY_QUEUE = {
  earlyId: fixtureId(2),
  holderId: fixtureId(1),
  urgentId: fixtureId(3),
  warehouseId: OWN_NETWORK_SITES[0].id,
} as const;

export const callYardWorker = async <TInput extends DescMessage, TOutput extends DescMessage>(
  worker: EngineWorkerRobotValue,
  method: DescMethodUnary<TInput, TOutput>,
  input: MessageInitShape<TInput>,
): Promise<MessageShape<TOutput>> => {
  const request = toBinary(method.input, create(method.input, input));
  return fromBinary(method.output, await worker.call(`${method.parent.typeName}/${method.name}`, request));
};

export const readQueueSeed = async (page: Page): Promise<YardPolicyQueueSeedValue> => {
  const seed = await createEngineWorkerRobot(page, DEAL_CUSTOMER);
  try {
    const { warehouseId } = YARD_POLICY_QUEUE;
    const receiving = WarehouseReceivingService.method.listReceivingTasks;
    const [{ topology }, target, source] = await Promise.all([
      callYardWorker(seed, WarehouseTopologyService.method.getWarehouseTopology, { warehouseId }),
      callYardWorker(seed, receiving, { warehouseId }),
      callYardWorker(seed, receiving, { warehouseId: OWN_NETWORK_SITES[2].id }),
    ]);
    const area = topology?.receivingArea;
    const dock = area?.unloadingPoint;
    const [task] = source.tasks;
    if (area === undefined || dock === undefined || task === undefined) {
      throw new Error('The queue fixture needs the seeded receiving area and a reference task');
    }
    expect(area.additionalUnloadingPoints).toHaveLength(0);
    expect(target.tasks).toHaveLength(0);
    const { deal } = await callYardWorker(seed, DealService.method.getDeal, { dealId: task.dealId });
    if (deal === undefined) {
      throw new Error('The reference task needs its seeded deal');
    }
    return { areaId: area.id, deal, dock, task };
  }
  finally {
    await seed.stop();
  }
};

export const storeYardPolicyReservedVisit = async (page: Page): Promise<WarehouseUnloadingPoint> => {
  const { areaId, deal, dock, task } = await readQueueSeed(page);
  await storeDockSlotArrival(page, deal, task, areaId);
  return dock;
};

const createQueueVisits = (seed: YardPolicyQueueSeedValue, visits: QueueVisitValue[], warehouseId: string): QueueRecordValue[] =>
  visits.flatMap(({ arrivedAtMs, dealId, isDocked, isUrgent, requiredQualifications }, index) => {
    const deal = create(DealSchema, {
      ...seed.deal,
      deliveryMethod: DeliveryMethod.SUPPLIER,
      id: dealId,
      isUrgent,
      shipToWarehouseId: warehouseId,
      status: DealStatus.ARRIVED,
      transitions: [create(DealTransitionSchema, {
        at: timestampFromMs(arrivedAtMs), from: DealStatus.IN_TRANSIT, to: DealStatus.ARRIVED,
      })],
    });
    const upd = create(DocumentSchema, {
      content: { terms: { case: 'upd', value: { lines: seed.task.orderLines.map(({ dealLineId, productName, quantityBase }) => ({
        dealLineId, productName, quantityBase,
      })) } } },
      dealId,
      displayNumber: `УПД-ДЕМО-76-${String(index + 1)}`,
      id: fixtureId(10 + index),
      issuerOrganizationId: deal.supplierOrganizationId,
      status: DocumentStatus.APPROVED,
      type: DocumentType.UPD,
      version: 1,
    });
    const task = create(ReceivingTaskSchema, {
      ...seed.task,
      assigneeUserId: isDocked ? DEAL_CUSTOMER.userId : undefined,
      dealId,
      dockSchedule: undefined,
      expectedUnits: seed.task.expectedUnits.map((unit, unitIndex) => ({ ...unit, id: fixtureId(20 + 10 * index + unitIndex) })),
      id: dealId,
      receivedUnits: [],
      receivingAreaId: seed.areaId,
      requiredQualifications: [...requiredQualifications ?? seed.task.requiredQualifications],
      sourceDocumentNumber: upd.displayNumber,
      status: isDocked ? ReceivingTaskStatus.IN_PROGRESS : ReceivingTaskStatus.OPEN,
      unloadingPointId: isDocked ? seed.dock.id : undefined,
      updDocumentId: upd.id,
      version: 1,
      warehouseId,
      yardAdmissionStatus: isDocked ? YardAdmissionStatus.ADMITTED : YardAdmissionStatus.WAITING_DOCK,
    });
    return [
      { bytes: Array.from(toBinary(DealSchema, deal)), id: deal.id, table: 'deals' },
      { bytes: Array.from(toBinary(DocumentSchema, upd)), id: upd.id, table: 'documents' },
      { bytes: Array.from(toBinary(ReceivingTaskSchema, task)), id: task.id, table: 'warehouseInbound' },
    ];
  });

const writeYardQueue = (page: Page, puts: QueueRecordValue[], tenantId: string, warehouseId: string): Promise<void> =>
  page.evaluate(async ({ databaseName, puts, tenantId, warehouseId }): Promise<void> => {
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
        const transaction = db.transaction(['deals', 'documents', 'memberships', 'warehouseInbound'], 'readwrite');
        transaction.oncomplete = (): void => {
          resolve();
        };
        transaction.onabort = (): void => {
          reject(transaction.error ?? new Error('Could not store the dock queue'));
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
  }, { databaseName: DATABASE_NAME, puts, tenantId, warehouseId });

export const storeYardPolicyQueue = async (page: Page): Promise<WarehouseUnloadingPoint> => {
  const seed = await readQueueSeed(page);
  const { earlyId, holderId, urgentId, warehouseId } = YARD_POLICY_QUEUE;
  const visits: QueueVisitValue[] = [
    { arrivedAtMs: Date.UTC(2026, 9, 12, 5, 0), dealId: holderId, isDocked: true, isUrgent: false },
    { arrivedAtMs: Date.UTC(2026, 9, 12, 5, 20), dealId: earlyId, isDocked: false, isUrgent: false },
    { arrivedAtMs: Date.UTC(2026, 9, 12, 5, 40), dealId: urgentId, isDocked: false, isUrgent: true },
  ];
  const observerMembership = create(MembershipSchema, {
    id: '30000010-0000-4000-8000-000000000000',
    organizationId: seed.deal.customerOrganizationId,
    roleAssignments: [{ roleId: '40500001-0000-4000-8000-000000000000', warehouseIds: [] }],
    userId: '20000010-0000-4000-8000-000000000000',
  });
  const puts = createQueueVisits(seed, visits, warehouseId);
  puts.push({ bytes: Array.from(toBinary(MembershipSchema, observerMembership)), id: observerMembership.id, table: 'memberships' });

  await writeYardQueue(page, puts, seed.deal.customerOrganizationId, warehouseId);
  return seed.dock;
};

export const prepareYardResourceQueue = async (page: Page): Promise<{
  earlyId: string;
  leadDocumentNumber: string;
  manualId: string;
  releaseDock: WarehouseUnloadingPoint;
  releaseTaskId: string;
  warehouseId: string;
}> => {
  const worker = await createEngineWorkerRobot(page, DEAL_CUSTOMER);
  const { warehouseId } = KAZAN_SCOPE;
  const { sample, tasks, topology } = await (async () => {
    const [{ tasks }, { topology }] = await Promise.all([
      callYardWorker(worker, WarehouseReceivingService.method.listReceivingTasks, KAZAN_SCOPE),
      callYardWorker(worker, WarehouseTopologyService.method.getWarehouseTopology, KAZAN_SCOPE),
    ]);
    const manualTask = tasks.find(task => task.requiredQualifications.length === 0);
    if (manualTask === undefined) {
      throw new Error('The resource queue needs a manual receipt');
    }
    const { deal } = await callYardWorker(worker, DealService.method.getDeal, { dealId: manualTask.dealId });
    if (deal === undefined) {
      throw new Error('The resource queue needs the source deal');
    }
    return { sample: { deal, task: manualTask }, tasks, topology };
  })().finally(worker.stop);
  const area = topology?.receivingArea;
  const dock = area?.unloadingPoint;
  const releaseDock = area?.additionalUnloadingPoints[0];
  const leadTask = tasks.find(task => task.requiredQualifications.includes(WarehouseStaffQualificationKind.FORKLIFT));
  if (area === undefined || dock === undefined || releaseDock === undefined || leadTask === undefined) {
    throw new Error('The resource queue needs both Kazan docks and a forklift receipt');
  }
  const releaseTaskId = sample.task.id;
  const earlyId = fixtureId(51);
  const manualId = fixtureId(52);
  const at = Date.UTC(2026, 9, 12, 8);
  const visits: QueueVisitValue[] = [
    {
      arrivedAtMs: at, dealId: earlyId, isDocked: false, isUrgent: false,
      requiredQualifications: [WarehouseStaffQualificationKind.COLD_ROOM, WarehouseStaffQualificationKind.FORKLIFT],
    },
    { arrivedAtMs: at + 60_000, dealId: manualId, isDocked: false, isUrgent: false, requiredQualifications: [] },
  ];
  const puts = createQueueVisits({ ...sample, areaId: area.id, dock }, visits, warehouseId);
  for (const task of tasks) {
    const unloadingPointId = task.id === leadTask.id ? dock.id : task.id === releaseTaskId ? releaseDock.id : undefined;
    const isDocked = unloadingPointId !== undefined;
    const openStatus = isDocked ? ReceivingTaskStatus.OPEN : ReceivingTaskStatus.UNSPECIFIED;
    const record = create(ReceivingTaskSchema, {
      ...task,
      assigneeUserId: task.id === releaseTaskId ? DEAL_CUSTOMER.userId : undefined,
      dockSchedule: undefined,
      receivedUnits: [],
      status: task.id === releaseTaskId ? ReceivingTaskStatus.IN_PROGRESS : openStatus,
      unloadingPointId,
      version: isDocked ? 1 : 0,
      yardAdmissionStatus: isDocked ? YardAdmissionStatus.ADMITTED : YardAdmissionStatus.UNSPECIFIED,
    });
    puts.push({ bytes: Array.from(toBinary(ReceivingTaskSchema, record)), id: record.id, table: 'warehouseInbound' });
  }
  await writeYardQueue(page, puts, sample.deal.customerOrganizationId, warehouseId);
  await changeStoredEngineMetadata(page, { isClockPaused: true, seedVersionOffset: 0, worldTimeMs: Date.UTC(2026, 9, 12, 10) });
  return { earlyId, leadDocumentNumber: leadTask.sourceDocumentNumber, manualId, releaseDock, releaseTaskId, warehouseId };
};
