import type {
  DescMessage,
  DescMethodUnary,
  MessageInitShape,
} from '@bufbuild/protobuf';
import type {
  Locator,
  Page,
} from '@playwright/test';
import type { ErrorDetail } from '@skladburg/contracts/common/v1/error';
import type {
  ListReceivingTasksResponse,
  YardDispatchEntry,
} from '@skladburg/contracts/wms/v1/receiving';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { errorFromJsonBytes } from '@connectrpc/connect/protocol-connect';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { tasksChannel } from '@skladburg/contracts/runtime';
import {
  AssignYardVisitToDockResponseSchema,
  WarehouseReceivingService,
  YardAdmissionStatus,
  YardDispatchAction,
  YardDispatchOutcome,
} from '@skladburg/contracts/wms/v1/receiving';
import { randomUUID } from 'node:crypto';

import type {
  EngineWorkerRobotValue,
  WorkerResponseValue,
} from './robots/engine-worker-robot.ts';

import { PERSONAS } from './fixtures/demoData.ts';
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
import {
  storeYardDispatchQueue,
  YARD_DISPATCH_QUEUE,
} from './fixtures/yardDispatchQueue.ts';
import { callYardWorker } from './fixtures/yardPolicyQueue.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

const SCOPE = { warehouseId: YARD_DISPATCH_QUEUE.warehouseId };
const HASH = toObjectHash(toWarehouseRoute(SCOPE.warehouseId));
const ASSIGN_REASON = 'Освободилась подходящая рампа';
const PROMOTE_REASON = 'Товар нужен к началу смены';
const { method } = WarehouseReceivingService;

const required = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`Expected ${label}`);
  }
  return value;
};

const postYardCommand = <TInput extends DescMessage, TOutput extends DescMessage>(
  worker: EngineWorkerRobotValue,
  rpc: DescMethodUnary<TInput, TOutput>,
  input: MessageInitShape<TInput>,
): Promise<WorkerResponseValue> =>
  worker.request(`${rpc.parent.typeName}/${rpc.name}`, toBinary(rpc.input, create(rpc.input, input)));

const readFailure = (response: WorkerResponseValue): ErrorDetail | undefined => {
  expect(response.status).toBeGreaterThanOrEqual(400);
  return errorFromJsonBytes(response.body, response.headers, new ConnectError('Missing dispatch error', Code.Unknown))
    .findDetails(ErrorDetailSchema)[0];
};

const readTasks = (worker: EngineWorkerRobotValue): Promise<ListReceivingTasksResponse> =>
  callYardWorker(worker, method.listReceivingTasks, SCOPE);

const readJournal = async (worker: EngineWorkerRobotValue): Promise<YardDispatchEntry[]> =>
  (await callYardWorker(worker, method.listYardDispatchEntries, SCOPE)).entries;

const receipt = (page: Page, taskId: string): Locator =>
  page.getByTestId('warehouse-receiving-task').filter({ has: page.locator(`a[href="#/deals/${taskId}"]`) });

const expectPromotion = async (card: Locator): Promise<void> => {
  const factors = card.getByTestId('yard-priority-reasons');
  const manualPromotion = factors.locator('[data-factor="MANUAL_PROMOTION"]');
  await expect(manualPromotion).toHaveCount(1);
  if (!(await factors.isVisible())) {
    await card.getByTestId('yard-priority-details').click();
  }
  await expect(manualPromotion).toBeVisible();
};

test.use({ initialGraphicsPreference: 'off', viewport: DESKTOP_VIEWPORT });

test('serializes competing dock commands, projects manual priority in two tabs and restores the journal', async ({ context, page }) => {
  test.setTimeout(90_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  const control = await context.newPage();
  const dock = await storeYardDispatchQueue(control);
  const reader = await createEngineWorkerRobot(control, DEAL_CUSTOMER);
  const competitorPage = await context.newPage();
  const competitor = await createEngineWorkerRobot(competitorPage, DEAL_CUSTOMER);
  const colleague = await context.newPage();
  const pages = [page, colleague];
  const scenes = pages.map(createSceneRobot);
  let entries: YardDispatchEntry[];
  let confirmed: ListReceivingTasksResponse;

  try {
    await expect.poll(reader.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    await expect.poll(competitor.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    for (const scene of scenes) {
      scene.watchSceneChunkRequests();
      scene.watchPageErrors();
    }
    await Promise.all(pages.map(tab => createPersonaRobot(tab).openAsPersona(HASH, PERSONAS.freshCustomer.id)));
    await Promise.all(pages.map(tab => expect(tab.getByTestId('warehouse-receiving-task')).toHaveCount(2)));
    await freezeEngineClock(page, colleague, control, competitorPage);
    const { worldTime } = await callYardWorker(reader, ClockService.method.getWorldClock, {});
    expect(worldTime).toBeDefined();
    expect(await readJournal(reader)).toEqual([]);
    const { tasks: initial } = await readTasks(reader);
    expect(initial.map(task => task.id)).toEqual([...YARD_DISPATCH_QUEUE.taskIds]);
    expect(initial.every(task => task.unloadingPointId === undefined && task.dockSchedule === undefined)).toBe(true);
    const advances = [reader, competitor];
    const subscription = await reader.subscribe(tasksChannel(SCOPE.warehouseId));
    expect(subscription.kind).toBe('subscribed');
    const readChanges = async (): Promise<string[]> =>
      (await reader.readEvents(subscription.id)).map(event => event.payload.case ?? '');

    const attempts = await Promise.all(initial.map(async (task, index) => {
      const worker = required(advances[index], 'a dispatch Worker');
      const command = {
        ...SCOPE,
        expectedVersion: task.version,
        idempotencyKey: randomUUID(),
        reason: ASSIGN_REASON,
        taskId: task.id,
        unloadingPointId: dock.id,
      };
      return { command, response: await postYardCommand(worker, method.assignYardVisitToDock, command), worker };
    }));
    expect(attempts.filter(attempt => attempt.response.status === 200)).toHaveLength(1);
    const winner = required(attempts.find(attempt => attempt.response.status === 200), 'the successful assignment');
    const loser = required(attempts.find(attempt => attempt.response.status !== 200), 'the rejected assignment');
    const assigned = fromBinary(AssignYardVisitToDockResponseSchema, winner.response.body);
    expect(assigned).toMatchObject({
      entryId: expect.any(String),
      outcome: YardDispatchOutcome.DOCK_ASSIGNED,
      taskId: winner.command.taskId,
      taskVersion: winner.command.expectedVersion + 1,
      unloadingPointId: dock.id,
    });
    expect(assigned.reservation).toBeUndefined();
    expect(readFailure(loser.response)).toMatchObject({
      code: ErrorCode.YARD_DISPATCH_BLOCKED,
      params: { case: 'yardDispatchBlocked', value: { reason: 'DOCK_BUSY' } },
    });
    await expect.poll(readChanges).toEqual(['receivingTasksChanged']);
    expect(await readJournal(reader)).toHaveLength(1);
    await Promise.all(pages.map(async (tab): Promise<void> => {
      await expect(receipt(tab, assigned.taskId).getByTestId('warehouse-receiving-dock')).toContainText(dock.code);
      await expect(receipt(tab, loser.command.taskId).getByTestId('yard-waiting-reason')).toHaveAttribute('data-reason', 'DOCKS_BUSY');
      await expect(receipt(tab, loser.command.taskId).locator('[data-factor="MANUAL_PROMOTION"]')).toHaveCount(0);
    }));

    const promotion = {
      ...SCOPE,
      expectedVersion: loser.command.expectedVersion,
      idempotencyKey: randomUUID(),
      reason: `  ${PROMOTE_REASON}  `,
      taskId: loser.command.taskId,
    };
    const promoted = await callYardWorker(reader, method.promoteYardVisit, promotion);
    expect(promoted).toMatchObject({
      entryId: expect.any(String),
      outcome: YardDispatchOutcome.WAITING,
      taskId: promotion.taskId,
      taskVersion: promotion.expectedVersion + 1,
    });
    expect(promoted.unloadingPointId).toBeUndefined();
    expect(promoted.reservation).toBeUndefined();
    await expect.poll(readChanges).toEqual(['receivingTasksChanged', 'receivingTasksChanged']);
    await Promise.all(pages.map(tab => expectPromotion(receipt(tab, promoted.taskId))));

    const expectedBefore = {
      isManuallyPrioritized: false, taskVersion: 1, yardAdmissionStatus: YardAdmissionStatus.WAITING_DOCK,
    };
    const journalScope = { ...SCOPE, actorUserId: DEAL_CUSTOMER.userId, occurredAt: worldTime, tenantId: DEAL_CUSTOMER.organizationId };
    entries = await readJournal(reader);
    expect(entries).toMatchObject([
      {
        ...journalScope,
        action: YardDispatchAction.PROMOTE,
        after: { ...expectedBefore, isManuallyPrioritized: true, taskVersion: promoted.taskVersion },
        before: expectedBefore,
        id: promoted.entryId,
        outcome: YardDispatchOutcome.WAITING,
        reason: PROMOTE_REASON,
        sequence: 2n,
        taskId: promoted.taskId,
      },
      {
        ...journalScope,
        action: YardDispatchAction.ASSIGN_DOCK,
        after: {
          ...expectedBefore,
          taskVersion: assigned.taskVersion,
          unloadingPointId: dock.id,
          yardAdmissionStatus: YardAdmissionStatus.ADMITTED,
        },
        before: expectedBefore,
        id: assigned.entryId,
        outcome: YardDispatchOutcome.DOCK_ASSIGNED,
        reason: ASSIGN_REASON,
        sequence: 1n,
        taskId: assigned.taskId,
      },
    ]);
    expect(entries.map(entry => [entry.before?.reservation, entry.after?.reservation])).toEqual([
      [undefined, undefined], [undefined, undefined],
    ]);
    expect(await callYardWorker(winner.worker, method.assignYardVisitToDock, winner.command)).toEqual(assigned);
    expect(await callYardWorker(reader, method.promoteYardVisit, promotion)).toEqual(promoted);
    const stale = await postYardCommand(competitor, method.promoteYardVisit, { ...promotion, idempotencyKey: randomUUID() });
    expect(readFailure(stale)).toMatchObject({
      code: ErrorCode.VERSION_CONFLICT,
      params: { case: 'versionConflict', value: { currentVersion: promoted.taskVersion } },
    });
    const changed = await postYardCommand(reader, method.promoteYardVisit, { ...promotion, reason: 'Поставка задерживается' });
    expect(readFailure(changed)).toMatchObject({ code: ErrorCode.IDEMPOTENCY_KEY_REUSED });
    expect(await readJournal(reader)).toEqual(entries);
    expect(await readChanges()).toEqual(['receivingTasksChanged', 'receivingTasksChanged']);

    confirmed = await readTasks(reader);
    expect(confirmed.tasks.filter(task => task.unloadingPointId !== undefined).map(task => task.id)).toEqual([assigned.taskId]);
    await colleague.reload();
    await expect(receipt(colleague, assigned.taskId).getByTestId('warehouse-receiving-dock')).toContainText(dock.code);
    await expectPromotion(receipt(colleague, promoted.taskId));
    for (const scene of scenes) {
      await scene.expectNoCanvas();
      expect(scene.countRequestedSceneChunks()).toBe(0);
      expect(scene.readPageErrors()).toEqual([]);
    }
  }
  finally {
    await Promise.all(pages.map(tab => tab.close()));
    await competitor.stop();
    await competitorPage.close();
    await reader.stop();
  }

  const restored = await createEngineWorkerRobot(control, DEAL_CUSTOMER);
  try {
    await expect.poll(restored.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect(await readJournal(restored)).toEqual(entries);
    expect(await readTasks(restored)).toEqual(confirmed);
  }
  finally {
    await restored.stop();
  }
});
