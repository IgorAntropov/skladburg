import type {
  Locator,
  Page,
} from '@playwright/test';
import type {
  ListReceivingTasksResponse,
  ReceivingTask,
} from '@skladburg/contracts/wms/v1/receiving';
import type { GetYardQueuePolicyResponse } from '@skladburg/contracts/wms/v1/yard_queue_policy';

import { TripDocumentsService } from '@skladburg/contracts/logistics/v1/trip_documents';
import {
  ReceivingTaskStatus,
  WarehouseReceivingService,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { YardQueuePolicyService } from '@skladburg/contracts/wms/v1/yard_queue_policy';
import { randomUUID } from 'node:crypto';

import type { ColorSchemeValue } from './fixtures/themePreference.ts';

import { expectNoAxeViolations } from './fixtures/axe.ts';
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
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import {
  callYardWorker,
  storeYardPolicyQueue,
  storeYardPolicyReservedVisit,
  YARD_POLICY_QUEUE,
} from './fixtures/yardPolicyQueue.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import {
  readYardPolicySaveGate,
  releaseYardPolicySave,
  setupYardPolicySaveGate,
} from './robots/yard-policy-save-gate.ts';

const WAREHOUSE = { warehouseId: YARD_POLICY_QUEUE.warehouseId };
const HASH = toObjectHash(toWarehouseRoute(WAREHOUSE.warehouseId));
const DEFAULT_WEIGHTS = {
  'cargo-urgency': '55',
  'delivery-window': '25',
  'explicit-urgency': '100',
  'resource-availability': '5',
  'waiting-time': '10',
} as const;
const WEIGHT_FIELDS = [
  'cargo-urgency', 'delivery-window', 'explicit-urgency', 'resource-availability', 'waiting-time',
] as const;

type YardWeightFieldValue = typeof WEIGHT_FIELDS[number];

const policyPanel = (page: Page): Locator => page.getByTestId('yard-queue-policy');

const weightField = (page: Page, label: YardWeightFieldValue): Locator => {
  const field = policyPanel(page).getByTestId(`yard-queue-weight-${label}`);
  return field.and(page.locator('input')).or(field.locator('input'));
};

const expectWeights = async (page: Page, expected: Record<YardWeightFieldValue, string>): Promise<void> => {
  await Promise.all(WEIGHT_FIELDS.map(weight => expect(weightField(page, weight)).toHaveValue(expected[weight])));
};

const openWarehouse = async (page: Page, colorScheme: ColorSchemeValue): Promise<void> => {
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
  await createPersonaRobot(page).openAsPersona(HASH, PERSONAS.freshCustomer.id);
  await expect(page.getByTestId('yard-queue-policy-open')).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
};

const openPolicy = async (page: Page, usesKeyboard = false): Promise<void> => {
  const open = page.getByTestId('yard-queue-policy-open');
  if (usesKeyboard) {
    await open.press('Enter');
  }
  else {
    await open.click();
  }
  await expect(policyPanel(page)).toBeVisible();
};

const receipt = (page: Page, dealId: string): Locator =>
  page.getByTestId('warehouse-receiving-task').filter({ has: page.locator(`a[href="#/deals/${dealId}"]`) });

test.use({ initialGraphicsPreference: 'off', viewport: DESKTOP_VIEWPORT });

test('keeps a stale draft for comparison and confirms loading current weights', async ({ context, page }, testInfo) => {
  test.setTimeout(90_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  await context.addInitScript({ content: createStoreSystemThemeScript() });
  const colleague = await context.newPage();
  await colleague.setViewportSize(PHONE_VIEWPORT);
  await setupYardPolicySaveGate(colleague);
  const pageScene = createSceneRobot(page);
  const colleagueScene = createSceneRobot(colleague);
  pageScene.watchSceneChunkRequests();
  colleagueScene.watchSceneChunkRequests();

  await openWarehouse(page, 'light');
  await openWarehouse(colleague, 'dark');
  await openPolicy(page);
  await openPolicy(colleague, true);
  await expectWeights(page, DEFAULT_WEIGHTS);
  await expectWeights(colleague, DEFAULT_WEIGHTS);
  await expectNoAxeViolations(colleague);

  const firstWeight = weightField(page, 'explicit-urgency');
  const draftWeight = weightField(colleague, 'explicit-urgency');
  const draftResource = weightField(colleague, 'resource-availability');
  const editor = policyPanel(colleague);
  const saveDraft = editor.getByTestId('yard-queue-policy-save');
  const conflict = editor.getByTestId('yard-queue-policy-conflict');
  const compare = editor.getByTestId('yard-queue-policy-compare');
  const current = editor.getByTestId('yard-queue-policy-current');
  const reload = editor.getByTestId('yard-queue-policy-reload');
  const discard = editor.getByTestId('yard-queue-policy-discard');
  const stay = discard.getByTestId('yard-queue-policy-discard-stay');
  const leave = discard.getByTestId('yard-queue-policy-discard-leave');
  const gate = await readYardPolicySaveGate(colleague);

  for (const invalid of ['', '1.5', '-1', '101']) {
    await draftWeight.fill(invalid);
    await saveDraft.press('Enter');
    await expect(draftWeight).toHaveAttribute('aria-invalid', 'true');
    await expect(draftWeight).toHaveValue(invalid);
    expect(await gate.evaluate(state => state.attempts)).toBe(0);
  }

  await firstWeight.fill('64');
  await draftWeight.fill('37');
  await draftResource.fill('13');
  await saveDraft.press('Enter');
  await expect.poll(() => gate.evaluate(state => state.send !== undefined)).toBe(true);

  await policyPanel(page).getByTestId('yard-queue-policy-save').click();
  await expect(conflict).toBeVisible();
  await expectWeights(colleague, {
    ...DEFAULT_WEIGHTS,
    'explicit-urgency': '37',
    'resource-availability': '13',
  });
  await releaseYardPolicySave(gate);
  await expect.poll(() => gate.evaluate(state => state.status)).toBe(409);

  await compare.press('Enter');
  await expect(current).toBeVisible();
  await expect(current).toContainText(/\b64\b/u);
  await expect(draftWeight).toHaveValue('37');
  await expect(draftResource).toHaveValue('13');
  await colleague.screenshot({ path: testInfo.outputPath('yard-policy-conflict-narrow-dark.png') });

  await reload.press('Enter');
  await expect(discard).toBeVisible();
  await stay.press('Enter');
  await expect(draftWeight).toHaveValue('37');
  await expect(conflict).toBeVisible();
  await reload.press('Enter');
  await leave.press('Enter');
  const savedWeights = { ...DEFAULT_WEIGHTS, 'explicit-urgency': '64' };
  await expectWeights(colleague, savedWeights);
  await expect(conflict).toHaveCount(0);
  expect(await gate.evaluate(state => state.attempts)).toBe(1);

  await draftResource.fill('14');
  await editor.getByTestId('yard-queue-policy-close').press('Enter');
  await expect(discard).toBeVisible();
  await stay.press('Enter');
  await expect(draftResource).toHaveValue('14');
  await editor.getByTestId('yard-queue-policy-close').press('Enter');
  await leave.press('Enter');
  await expect(editor).toHaveCount(0);

  await colleague.reload();
  await openPolicy(colleague, true);
  await expectWeights(colleague, savedWeights);
  await expectWeights(page, savedWeights);
  await page.screenshot({ path: testInfo.outputPath('yard-policy-saved-light.png') });
  await createPersonaRobot(colleague).selectPersona(PERSONAS.freshStorekeeper);
  await expect(colleague.getByTestId('warehouse-workspace')).toBeVisible();
  await expect(colleague.getByTestId('yard-queue-policy-open')).toHaveCount(0);
  await expect(editor).toHaveCount(0);
  for (const scene of [pageScene, colleagueScene]) {
    await scene.expectNoCanvas();
    expect(scene.countRequestedSceneChunks()).toBe(0);
  }
});

test('refreshes the priority in a second tab and assigns the released dock using the new weights', async ({ context, page }) => {
  test.setTimeout(90_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  await context.addInitScript({ content: createStoreSystemThemeScript() });
  const controlPage = await context.newPage();
  const dock = await storeYardPolicyQueue(controlPage);
  const worker = await createEngineWorkerRobot(controlPage, DEAL_CUSTOMER);
  const colleague = await context.newPage();
  const { earlyId, holderId, urgentId } = YARD_POLICY_QUEUE;
  const { method } = WarehouseReceivingService;
  const readTasks = (): Promise<ListReceivingTasksResponse> => callYardWorker(worker, method.listReceivingTasks, WAREHOUSE);
  const readPolicy = (): Promise<GetYardQueuePolicyResponse> =>
    callYardWorker(worker, YardQueuePolicyService.method.getYardQueuePolicy, {});
  const urgentReceipt = receipt(colleague, urgentId);
  const earlyReceipt = receipt(colleague, earlyId);
  const urgentReason = urgentReceipt.getByTestId('yard-waiting-reason');
  const earlyReason = earlyReceipt.getByTestId('yard-waiting-reason');
  const details = urgentReceipt.getByTestId('yard-priority-details');
  const factors = urgentReceipt.getByTestId('yard-priority-reasons');
  const urgency = factors.locator('[data-factor="EXPLICIT_URGENCY"]');

  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    await openWarehouse(page, 'light');
    await openWarehouse(colleague, 'light');
    await expect(urgentReason).toHaveAttribute('data-reason', 'DOCKS_BUSY');
    await expect(earlyReason).toHaveAttribute('data-reason', 'DOCKS_BUSY');
    await details.click();
    await expect(urgency).toBeVisible();
    const before = (await readTasks()).tasks;
    expect(before.find(task => task.id === holderId)?.unloadingPointId).toBe(dock.id);
    expect(before.filter(task => task.unloadingPointId === undefined).map(task => task.id)).toEqual([earlyId, urgentId]);

    await openPolicy(colleague);
    await openPolicy(page);
    await expectWeights(page, DEFAULT_WEIGHTS);
    await expectWeights(colleague, DEFAULT_WEIGHTS);
    await weightField(page, 'explicit-urgency').fill('0');
    await policyPanel(page).getByTestId('yard-queue-policy-save').click();
    await expectWeights(colleague, { ...DEFAULT_WEIGHTS, 'explicit-urgency': '0' });
    expect((await readPolicy()).policy).toMatchObject({ version: 1n, weights: { explicitUrgencyWeight: 0 } });
    await policyPanel(colleague).getByTestId('yard-queue-policy-close').click();
    await expect(policyPanel(colleague)).toHaveCount(0);
    await expect(urgentReason).toHaveAttribute('data-reason', 'DOCKS_BUSY');
    if (!(await factors.isVisible())) {
      await details.click();
    }
    await expect(factors).toBeVisible();
    await expect(urgency).toHaveCount(0);
    expect((await readTasks()).tasks).toEqual(before);

    const holder = before.find(task => task.id === holderId);
    if (holder === undefined) {
      throw new Error('The active dock holder must be in the snapshot');
    }
    const finished = await callYardWorker(worker, method.finishReceivingTask, {
      ...WAREHOUSE, expectedVersion: holder.version, idempotencyKey: randomUUID(), taskId: holder.id,
    });
    expect(finished.task?.status).toBe(ReceivingTaskStatus.READY_FOR_RECONCILIATION);
    await expect(earlyReceipt.getByTestId('warehouse-receiving-dock')).toContainText(dock.code);
    await expect(earlyReason).toHaveCount(0);
    await expect(urgentReason).toHaveAttribute('data-reason', 'DOCKS_BUSY');
    const after = (await readTasks()).tasks;
    expect(after.find(task => task.id === earlyId)).toMatchObject({
      unloadingPointId: dock.id, version: 2, yardAdmissionStatus: YardAdmissionStatus.ADMITTED,
    });
    expect(after.find(task => task.id === urgentId)).toEqual(before.find(task => task.id === urgentId));
    await createPersonaRobot(colleague).selectPersona(PERSONAS.freshStorekeeper);
    await openPolicy(colleague);
    await expectWeights(colleague, { ...DEFAULT_WEIGHTS, 'explicit-urgency': '0' });
    await Promise.all(WEIGHT_FIELDS.map(field => expect(weightField(colleague, field)).not.toBeEditable()));
    await expect(policyPanel(colleague).getByTestId('yard-queue-policy-save')).toHaveCount(0);
    await Promise.all([page, colleague].map(tab => expect(tab.locator('canvas')).toHaveCount(0)));
  }
  finally {
    await worker.stop();
  }
});

test('keeps the confirmed future slot and its warehouse-local explanation after changing a weight', async ({ context, page }) => {
  test.setTimeout(60_000);
  await context.addInitScript({ content: createStoreSystemThemeScript() });
  const controlPage = await context.newPage();
  const dock = await storeYardPolicyReservedVisit(controlPage);
  const worker = await createEngineWorkerRobot(controlPage, DEAL_CUSTOMER);
  const carrierPage = await context.newPage();
  const { carrierOrganizationId, carrierUserId, dealId, tripId } = DOCK_SLOT_ARRIVAL;
  const carrier = await createEngineWorkerRobot(carrierPage, { organizationId: carrierOrganizationId, userId: carrierUserId });
  const readArrival = async (): Promise<ReceivingTask | undefined> => {
    const { tasks } = await callYardWorker(worker, WarehouseReceivingService.method.listReceivingTasks, WAREHOUSE);
    return tasks.find(task => task.dealId === dealId);
  };

  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    await openWarehouse(page, 'light');
    await freezeEngineClock(page, controlPage, carrierPage);
    await callYardWorker(carrier, TripDocumentsService.method.submitCarrierTitle, {
      expectedVersion: 1, idempotencyKey: randomUUID(), tripId,
    });
    const before = await readArrival();
    expect(before).toMatchObject({
      dockSchedule: { reservation: { unloadingPointId: dock.id } }, yardAdmissionStatus: YardAdmissionStatus.WAITING_DOCK,
    });
    expect(before?.unloadingPointId).toBeUndefined();
    const reason = receipt(page, dealId).getByTestId('yard-waiting-reason');
    await expect(reason).toHaveAttribute('data-reason', 'WAITING_SLOT');
    await expect(reason).toContainText('09:02');

    await openPolicy(page);
    await weightField(page, 'cargo-urgency').fill('0');
    const editor = policyPanel(page);
    await editor.getByTestId('yard-queue-policy-save').click();
    await expect.poll(async () => (await callYardWorker(worker, YardQueuePolicyService.method.getYardQueuePolicy, {})).policy)
      .toMatchObject({ version: 1n, weights: { cargoUrgencyWeight: 0 } });
    await editor.getByTestId('yard-queue-policy-close').click();
    await expect(editor).toHaveCount(0);
    await expect(reason).toHaveAttribute('data-reason', 'WAITING_SLOT');
    expect(await readArrival()).toEqual(before);
    await expect(page.locator('canvas')).toHaveCount(0);
  }
  finally {
    await carrier.stop();
    await worker.stop();
  }
});
