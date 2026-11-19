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
import {
  timestampFromMs,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { TripDocumentsService } from '@skladburg/contracts/logistics/v1/trip_documents';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  ReceivingTaskStatus,
  WarehouseReceivingService,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
import { randomUUID } from 'node:crypto';

import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';

import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import {
  DOCK_SLOT_ARRIVAL,
  storeDockSlotArrival,
} from './fixtures/dockSlotArrival.ts';
import { freezeEngineClock } from './fixtures/engineClock.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import {
  toObjectHash,
  toWarehouseRoute,
} from './fixtures/routes.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { readStoredEngineSnapshot } from './robots/engine-storage-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

const SCOPE = { warehouseId: DOCK_SLOT_ARRIVAL.warehouseId };
const WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(SCOPE.warehouseId));
const DOCK_SCHEDULE_REFRESH_MS = 1_000;
const SLOT_DURATION_MS = 30 * 60_000;

const required = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`Expected ${label}`);
  }
  return value;
};

const call = async <TInput extends DescMessage, TOutput extends DescMessage>(
  worker: EngineWorkerRobotValue,
  method: DescMethodUnary<TInput, TOutput>,
  request: MessageInitShape<TInput>,
): Promise<MessageShape<TOutput>> => {
  const body = toBinary(method.input, create(method.input, request));
  return fromBinary(method.output, await worker.call(`${method.parent.typeName}/${method.name}`, body));
};

const prepareArrival = async (page: Page): Promise<WarehouseUnloadingPoint> => {
  const seed = await createEngineWorkerRobot(page, DEAL_CUSTOMER);
  const readSource = async (): Promise<{
    areaId: string;
    deal: Deal;
    dock: WarehouseUnloadingPoint;
    task: ReceivingTask;
  }> => {
    const { method } = WarehouseReceivingService;
    const [{ topology }, empty, source] = await Promise.all([
      call(seed, WarehouseTopologyService.method.getWarehouseTopology, SCOPE),
      call(seed, method.listReceivingTasks, SCOPE),
      call(seed, method.listReceivingTasks, { warehouseId: OWN_NETWORK_SITES[2].id }),
    ]);
    expect(empty.tasks).toHaveLength(0);
    const area = required(topology?.receivingArea, 'the Moscow receiving area');
    const dock = required(area.unloadingPoint, 'the Moscow unloading point');
    const task = required(source.tasks[0], 'a seeded receiving task');
    const { deal } = await call(seed, DealService.method.getDeal, { dealId: task.dealId });
    return { areaId: area.id, deal: required(deal, 'the seeded deal'), dock, task };
  };
  const { areaId, deal, dock, task } = await readSource().finally(seed.stop);
  await storeDockSlotArrival(page, deal, task, areaId);
  return dock;
};

const readSavedWorldTime = async (page: Page): Promise<number | undefined> => {
  const value: unknown = JSON.parse(await readStoredEngineSnapshot(page, ['meta']));
  const row: unknown = Array.isArray(value) ? value[0] : undefined;
  if (!Array.isArray(row)) {
    return undefined;
  }
  const keys: unknown = row[1];
  const values: unknown = row[2];
  if (!Array.isArray(keys) || !Array.isArray(values)) {
    return undefined;
  }
  const metadata: unknown = values[keys.indexOf('engineMeta')];

  return typeof metadata === 'object' && metadata !== null && 'worldTimeMs' in metadata && typeof metadata.worldTimeMs === 'number'
    ? metadata.worldTimeMs
    : undefined;
};

test.use({ initialGraphicsPreference: 'off', viewport: DESKTOP_VIEWPORT });

test('activates an early truck reservation through WMS in two tabs and restores the assignment without 3D', async ({ context, page }) => {
  test.setTimeout(90_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  const controlPage = await context.newPage();
  const dock = await prepareArrival(controlPage);
  const reader = await createEngineWorkerRobot(controlPage, DEAL_CUSTOMER);
  await expect.poll(reader.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
  const carrierPage = await context.newPage();
  const { carrierOrganizationId, carrierUserId, dealId, startsAtMs, tripId } = DOCK_SLOT_ARRIVAL;
  const carrier = await createEngineWorkerRobot(carrierPage, { organizationId: carrierOrganizationId, userId: carrierUserId });
  const secondPage = await context.newPage();
  const pages = [page, secondPage];
  const scenes = pages.map(createSceneRobot);
  const receipts = pages.map(tab => tab.getByTestId('warehouse-receiving-task')
    .filter({ has: tab.locator(`a[href="#/deals/${dealId}"]`) }));
  const dockLabels = receipts.map(receipt => receipt.getByTestId('warehouse-receiving-dock'));
  const waitingReasons = receipts.map(receipt => receipt.getByTestId('yard-waiting-reason'));
  const claims = receipts.map(receipt => receipt.getByTestId('warehouse-claim-receiving'));
  const scans = receipts.map(receipt => receipt.getByTestId('warehouse-enter-sscc'));
  const finishes = receipts.map(receipt => receipt.getByTestId('warehouse-finish-receiving'));
  const readTask = async (): Promise<ReceivingTask> => {
    const { tasks } = await call(reader, WarehouseReceivingService.method.listReceivingTasks, SCOPE);
    return required(tasks.find(task => task.dealId === dealId), 'the early visit');
  };
  const readClock = async (): Promise<number> => {
    const { worldTime } = await call(reader, ClockService.method.getWorldClock, {});
    return timestampMs(required(worldTime, 'the current world time'));
  };

  try {
    for (const scene of scenes) {
      scene.watchSceneChunkRequests();
      scene.watchPageErrors();
    }
    await Promise.all(pages.map(tab => createPersonaRobot(tab).openAsPersona(WAREHOUSE_HASH, PERSONAS.freshCustomer.id)));
    await Promise.all(waitingReasons.map(reason => expect(reason).toBeVisible()));
    await Promise.all(waitingReasons.map(reason => expect(reason).toHaveAttribute('data-reason', 'WAITING_DOCUMENTS')));
    const advanceClock = await freezeEngineClock(page, carrierPage, controlPage);
    const initial = await readTask();
    expect(initial.yardAdmissionStatus).toBe(YardAdmissionStatus.WAITING_DOCUMENTS);
    expect(initial.dockSchedule?.reservation).toBeUndefined();
    expect(initial.unloadingPointId).toBeUndefined();

    await call(carrier, TripDocumentsService.method.submitCarrierTitle, { expectedVersion: 1, idempotencyKey: randomUUID(), tripId });
    const waiting = await readTask();
    const startsAt = timestampFromMs(startsAtMs);
    const reservation = { endsAt: timestampFromMs(startsAtMs + SLOT_DURATION_MS), startsAt, unloadingPointId: dock.id };
    expect(waiting.yardAdmissionStatus).toBe(YardAdmissionStatus.WAITING_DOCK);
    expect(waiting.unloadingPointId).toBeUndefined();
    expect(waiting.dockSchedule).toMatchObject({ preferredStartsAt: startsAt, reservation });
    expect(waiting.version).toBe(initial.version + 1);
    await Promise.all(waitingReasons.map(reason => expect(reason).toBeVisible()));
    await Promise.all(waitingReasons.map(reason => expect(reason).toHaveAttribute('data-reason', 'WAITING_SLOT')));
    await Promise.all(dockLabels.map(label => expect(label).not.toContainText(dock.code)));

    await required(claims[0], 'the receiving claim action').click();
    await Promise.all(claims.map(claim => expect(claim).toHaveCount(0)));
    const claimed = await readTask();
    expect(claimed.status).toBe(ReceivingTaskStatus.IN_PROGRESS);
    expect(claimed.version).toBe(waiting.version + 1);
    expect(claimed.dockSchedule?.reservation).toEqual(waiting.dockSchedule?.reservation);
    await Promise.all([...scans, ...finishes].map(button => expect(button).toHaveCount(0)));
    const subscription = await reader.subscribe(tasksChannel(SCOPE.warehouseId));
    expect(subscription.kind).toBe('subscribed');

    const beforeStartMs = startsAtMs - 1;
    const nowMs = await readClock();
    expect(nowMs).toBeLessThan(beforeStartMs);
    await advanceClock(beforeStartMs - nowMs);
    await expect.poll(readClock).toBe(beforeStartMs);
    await expect.poll(() => readSavedWorldTime(controlPage), { timeout: 12_000 }).toBe(beforeStartMs);
    expect(await readTask()).toEqual(claimed);
    expect(await reader.readEvents(subscription.id)).toHaveLength(0);
    const secondLabel = required(dockLabels[1], 'the second dock indicator');
    const secondWaitingReason = required(waitingReasons[1], 'the second waiting reason');
    const secondScan = required(scans[1], 'the second receiving scan action');
    await secondPage.reload();
    await expect(secondWaitingReason).toBeVisible();
    await expect(secondWaitingReason).toHaveAttribute('data-reason', 'WAITING_SLOT');
    expect(await readTask()).toEqual(claimed);
    expect(await readClock()).toBe(beforeStartMs);
    await Promise.all([...scans, ...finishes].map(button => expect(button).toHaveCount(0)));

    await advanceClock(1);
    await expect.poll(readClock).toBe(startsAtMs);
    await advanceClock(DOCK_SCHEDULE_REFRESH_MS);
    await expect.poll(readClock).toBe(startsAtMs + DOCK_SCHEDULE_REFRESH_MS);
    await expect.poll(readTask).toMatchObject({
      dockSchedule: { reservation },
      unloadingPointId: dock.id,
      version: claimed.version + 1,
      yardAdmissionStatus: YardAdmissionStatus.ADMITTED,
    });
    const assigned = await readTask();
    await expect.poll(() => reader.readEvents(subscription.id)).toMatchObject([{
      payload: { case: 'receivingTasksChanged', value: { warehouseId: SCOPE.warehouseId } },
    }]);
    await Promise.all(dockLabels.map(label => expect(label).toContainText(dock.code)));
    await Promise.all(scans.map(scan => expect(scan).toBeVisible()));
    await secondPage.reload();
    await expect(secondLabel).toContainText(dock.code);
    await expect(secondScan).toBeVisible();
    expect(await readTask()).toEqual(assigned);
    expect(await reader.readEvents(subscription.id)).toHaveLength(1);
    for (const scene of scenes) {
      await scene.expectNoCanvas();
      expect(scene.countRequestedSceneChunks()).toBe(0);
      expect(scene.readPageErrors()).toEqual([]);
    }
  }
  finally {
    await carrier.stop();
    await reader.stop();
  }
});
