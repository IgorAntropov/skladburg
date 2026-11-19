import type {
  Locator,
  Page,
} from '@playwright/test';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { TripDocumentsService } from '@skladburg/contracts/logistics/v1/trip_documents';
import {
  DockSlotRescheduleReason,
  WarehouseReceivingService,
  YardDispatchAction,
} from '@skladburg/contracts/wms/v1/receiving';
import { randomUUID } from 'node:crypto';

import { PERSONAS } from './fixtures/demoData.ts';
import { DOCK_SLOT_ARRIVAL } from './fixtures/dockSlotArrival.ts';
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
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import {
  storeYardDispatchQueue,
  YARD_DISPATCH_QUEUE,
} from './fixtures/yardDispatchQueue.ts';
import {
  callYardWorker,
  storeYardPolicyQueue,
  storeYardPolicyReservedVisit,
  YARD_POLICY_QUEUE,
} from './fixtures/yardPolicyQueue.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { changeStoredEngineMetadata } from './robots/engine-storage-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

const SCOPE = { warehouseId: YARD_DISPATCH_QUEUE.warehouseId };
const HASH = toObjectHash(toWarehouseRoute(SCOPE.warehouseId));
const ASSIGN_REASON = 'Рампа свободна к началу смены';
const PROMOTE_REASON = 'Скоропортящийся груз ждёт разгрузки';
const DRAFT_REASON = 'Подать после освобождения проезда';
const YARD_SCENE_ASSET = /\/assets\/(?:WarehouseWorldScene|WarehouseYardDragLayer|qualityLevel)-[^/]+\.js$/u;
const { method } = WarehouseReceivingService;
const SLOT_CASES = [
  { label: 'counts down until WMS admits the visit', mode: 'on-time' },
  { label: 'keeps the reservation countdown fixed when the world is paused', mode: 'paused' },
  { label: 'replaces the missed reservation with the new WMS interval', mode: 'missed' },
] as const;

const yardTab = (page: Page): Locator => page.getByRole('tab').and(page.locator('[id$="-trigger-yard"]'));

const visit = (page: Page, taskId: string): Locator =>
  page.getByTestId('yard-dispatch-visit').and(page.locator(`[data-task-id="${taskId}"]`));

const reasonField = (page: Page): Locator => page.getByTestId('yard-dispatch-reason').getByRole('textbox');

const activateByKeyboard = async (button: Locator): Promise<void> => {
  await button.focus();
  await button.press('Enter');
};

const openYard = async (page: Page): Promise<void> => {
  await activateByKeyboard(yardTab(page));
  await expect(page.getByTestId('warehouse-yard-dispatch')).toBeVisible();
};

const chooseDock = async (page: Page, taskId: string, dockId: string, reason: string): Promise<void> => {
  await activateByKeyboard(visit(page, taskId).getByTestId('yard-dispatch-select'));
  await activateByKeyboard(page.getByTestId('yard-dispatch-assign'));
  await page.getByTestId('yard-dispatch-dock').getByRole('combobox').selectOption(dockId);
  await reasonField(page).fill(reason);
};

test.use({ initialGraphicsPreference: 'off', viewport: DESKTOP_VIEWPORT });

test('dispatches from the HUD and retains the reason in the other tab when the dock is taken', async ({ context, page }) => {
  test.setTimeout(90_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  const control = await context.newPage();
  const dock = await storeYardDispatchQueue(control);
  const worker = await createEngineWorkerRobot(control, DEAL_CUSTOMER);
  const colleague = await context.newPage();
  const tabs = [page, colleague];
  const scenes = tabs.map(createSceneRobot);
  const sceneRequests: string[] = [];
  const [firstId, secondId] = YARD_DISPATCH_QUEUE.taskIds;

  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    for (const scene of scenes) {
      scene.watchSceneChunkRequests();
      scene.watchPageErrors();
    }
    for (const tab of tabs) {
      tab.on('request', (request) => {
        if (YARD_SCENE_ASSET.test(new URL(request.url()).pathname)) {
          sceneRequests.push(request.url());
        }
      });
    }
    await Promise.all(tabs.map(tab => createPersonaRobot(tab).openAsPersona(HASH, PERSONAS.freshCustomer.id)));
    await Promise.all(tabs.map(openYard));
    for (const tab of tabs) {
      await expect(visit(tab, firstId)).toHaveAttribute('data-queue-position', '1');
      await expect(visit(tab, secondId)).toHaveAttribute('data-queue-position', '2');
    }
    await chooseDock(colleague, secondId, dock.id, DRAFT_REASON);
    await chooseDock(page, firstId, dock.id, ASSIGN_REASON);
    await activateByKeyboard(page.getByTestId('yard-dispatch-submit'));
    await expect(page.getByTestId('yard-dispatch-result')).toBeVisible();
    await expect(visit(page, firstId)).toContainText(dock.code);
    await expect(visit(colleague, firstId)).toContainText(dock.code);
    await expect(colleague.getByTestId('yard-dispatch-conflict')).toBeVisible();
    await expect(reasonField(colleague)).toHaveValue(DRAFT_REASON);
    await expect(colleague.getByTestId('yard-dispatch-submit')).toBeDisabled();
    await colleague.getByTestId('yard-dispatch-review').click();
    await expect(colleague.getByTestId('yard-dispatch-dock').getByRole('combobox')).toHaveValue('');
    await expect(reasonField(colleague)).toHaveValue(DRAFT_REASON);
    await expect(colleague.getByTestId('yard-dispatch-submit')).toBeDisabled();
    await colleague.getByTestId('yard-dispatch-cancel').click();
    await colleague.getByTestId('yard-dispatch-discard-leave').click();
    await activateByKeyboard(visit(page, secondId).getByTestId('yard-dispatch-select'));
    await activateByKeyboard(page.getByTestId('yard-dispatch-promote'));
    await reasonField(page).fill(PROMOTE_REASON);
    await activateByKeyboard(page.getByTestId('yard-dispatch-submit'));
    await expect.poll(async () => (await callYardWorker(worker, method.listYardDispatchEntries, SCOPE)).entries.map(entry => ({
      action: entry.action, reason: entry.reason, taskId: entry.taskId,
    }))).toEqual([
      { action: YardDispatchAction.PROMOTE, reason: PROMOTE_REASON, taskId: secondId },
      { action: YardDispatchAction.ASSIGN_DOCK, reason: ASSIGN_REASON, taskId: firstId },
    ]);
    await expect(visit(colleague, secondId)).toHaveAttribute('data-queue-position', '1');
    await colleague.reload();
    await openYard(colleague);
    await expect(visit(colleague, firstId)).toContainText(dock.code);
    await expect(visit(colleague, secondId)).toHaveAttribute('data-queue-position', '1');

    for (const scene of scenes) {
      await scene.expectNoCanvas();
      expect(scene.countRequestedSceneChunks()).toBe(0);
      expect(scene.readPageErrors()).toEqual([]);
    }
    expect(sceneRequests).toEqual([]);
  }
  finally {
    await worker.stop();
  }
});

for (const { label, mode } of SLOT_CASES) {
  test(label, async ({ context, page }) => {
    test.setTimeout(90_000);
    const control = await context.newPage();
    const dock = await storeYardPolicyReservedVisit(control);
    const isPaused = mode === 'paused';
    if (isPaused) {
      await changeStoredEngineMetadata(control, { isClockPaused: true, seedVersionOffset: 0 });
      await page.clock.install();
    }
    const worker = await createEngineWorkerRobot(control, DEAL_CUSTOMER);
    const carrierPage = await context.newPage();
    const { carrierOrganizationId, carrierUserId, dealId, startsAtMs, tripId } = DOCK_SLOT_ARRIVAL;
    const carrier = await createEngineWorkerRobot(carrierPage, { organizationId: carrierOrganizationId, userId: carrierUserId });
    const timer = page.getByTestId('yard-dispatch-slot-timer').and(page.locator(`[data-task-id="${dealId}"]`));

    try {
      await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
      await createPersonaRobot(page).openAsPersona(HASH, PERSONAS.freshCustomer.id);
      await openYard(page);
      await expect(visit(page, dealId)).toHaveAttribute('data-yard-state', 'blocked');
      const advance = isPaused ? undefined : await freezeEngineClock(page, control, carrierPage);
      await callYardWorker(carrier, TripDocumentsService.method.submitCarrierTitle, {
        expectedVersion: 1, idempotencyKey: randomUUID(), tripId,
      });
      await expect(visit(page, dealId)).toHaveAttribute('data-yard-state', 'slot');
      await expect(timer).toHaveAttribute('data-minutes', '2');
      await expect(visit(page, dealId)).toContainText(dock.code);
      await expect(visit(page, dealId)).toContainText('09:02');

      if (advance === undefined) {
        expect((await callYardWorker(worker, ClockService.method.getWorldClock, {})).timeScale).toBe(0);
        await page.clock.fastForward(180_000);
        await expect(timer).toHaveAttribute('data-minutes', '2');
        await expect(visit(page, dealId)).toHaveAttribute('data-yard-state', 'slot');
      }
      else {
        const { worldTime } = await callYardWorker(worker, ClockService.method.getWorldClock, {});
        if (worldTime === undefined) {
          throw new Error('The world clock is unavailable');
        }
        const toStartMs = startsAtMs - timestampMs(worldTime);
        expect(toStartMs).toBeGreaterThan(1_000);
        await advance(toStartMs + (mode === 'missed' ? 10 * 60_000 : 0) + 1_000);
        await expect(visit(page, dealId)).toHaveAttribute('data-yard-state', 'assigned');
        await expect(timer).toHaveCount(0);
        await expect(visit(page, dealId)).toContainText(dock.code);
        if (mode === 'missed') {
          const { tasks } = await callYardWorker(worker, method.listReceivingTasks, SCOPE);
          const schedule = tasks.find(task => task.id === dealId)?.dockSchedule;
          const moved = schedule?.reservation?.startsAt;
          expect(schedule?.lastRescheduleReason).toBe(DockSlotRescheduleReason.SLOT_EXPIRED);
          expect(moved === undefined ? undefined : timestampMs(moved)).toBe(startsAtMs + 10 * 60_000 + 1_000);
          await expect(visit(page, dealId)).toContainText('09:12');
          await expect(visit(page, dealId)).not.toContainText('09:02');
        }
      }
      await createSceneRobot(page).expectNoCanvas();
    }
    finally {
      await carrier.stop();
      await worker.stop();
    }
  });
}

test('shows the queue to a warehouse employee without offering dispatch commands', async ({ context, page }) => {
  const control = await context.newPage();
  await storeYardPolicyQueue(control);
  await createPersonaRobot(page).openAsPersona(HASH, PERSONAS.freshStorekeeper.id);
  await openYard(page);
  const waiting = visit(page, YARD_POLICY_QUEUE.earlyId);
  await expect(waiting).toHaveAttribute('data-yard-state', 'queue');
  await activateByKeyboard(waiting.getByTestId('yard-dispatch-select'));
  await expect(waiting.getByTestId('yard-dispatch-select')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('yard-dispatch-promote')).toHaveCount(0);
  await expect(page.getByTestId('yard-dispatch-assign')).toHaveCount(0);
  await createSceneRobot(page).expectNoCanvas();
});

test.describe('touch HUD', () => {
  test.use({ hasTouch: true, viewport: PHONE_VIEWPORT });

  test('selects a dock and confirms a reason by touch without 3D', async ({ context, page }) => {
    const control = await context.newPage();
    const dock = await storeYardDispatchQueue(control);
    const worker = await createEngineWorkerRobot(control, DEAL_CUSTOMER);
    const [firstId] = YARD_DISPATCH_QUEUE.taskIds;

    try {
      await createPersonaRobot(page).openAsPersona(HASH, PERSONAS.freshCustomer.id);
      await yardTab(page).tap();
      await visit(page, firstId).getByTestId('yard-dispatch-select').tap();
      await page.getByTestId('yard-dispatch-assign').tap();
      await page.getByTestId('yard-dispatch-dock').getByRole('combobox').selectOption(dock.id);
      await reasonField(page).fill(ASSIGN_REASON);
      await page.getByTestId('yard-dispatch-submit').tap();
      await expect(visit(page, firstId)).toHaveAttribute('data-yard-state', 'assigned');
      await expect.poll(async () => (await callYardWorker(worker, method.listYardDispatchEntries, SCOPE)).entries[0]).toMatchObject({
        reason: ASSIGN_REASON, taskId: firstId, warehouseId: SCOPE.warehouseId,
      });
      await createSceneRobot(page).expectNoCanvas();
    }
    finally {
      await worker.stop();
    }
  });
});
