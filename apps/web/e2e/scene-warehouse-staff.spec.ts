import { WarehouseReceivingService } from '@skladburg/contracts/wms/v1/receiving';
import { randomUUID } from 'node:crypto';

import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
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
import { callYardWorker } from './fixtures/yardPolicyQueue.ts';
import {
  prepareYardVehicleMarkings,
  YARD_MARKINGS_SCOPE,
} from './fixtures/yardVehicleMarkings.ts';
import { createAssistantRobot } from './robots/assistant-robot.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { DRAW_COUNTER_INIT_SCRIPT } from './robots/scene-draw-counter.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import { scanCode } from './robots/warehouse-delivery-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';
import {
  installYardMarkingSceneProbe,
  readYardMarkingSceneProbe,
} from './robots/yard-marking-scene-probe.ts';

const WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(OWN_NETWORK_SITES[2].id));
const OPERATOR_PERSONA_ID = '90000032-0000-4000-8000-000000000000';
const OPERATOR_STAFF_ID = '20000032-0000-4000-8000-000000000000';
const RECEIVING_AREA_ID = '8f000004-0000-4000-8000-000000000010';
const STORAGE_ZONE_ID = '8f000004-0000-4000-8000-000000000001';
const REST_MS = 700;

test.use({ hasTouch: true, reducedMotion: 'reduce', viewport: PHONE_VIEWPORT });

test('follows a confirmed warehouse worker on the scene and opens the same staff profile by touch and keyboard', async ({
  context, page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  const scene = createSceneRobot(page);
  scene.watchPageErrors();
  scene.watchSceneChunkRequests();
  await createPersonaRobot(page).openAsPersona(WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  await createAssistantRobot(page).dismissReplica('digest');
  await createWarehouseRobot(page).openStaffTab();
  const row = page.getByTestId(`warehouse-staff-open-${OPERATOR_STAFF_ID}`);
  await row.focus();
  await row.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('warehouse-staff-qualifications')).toBeVisible();
  await scene.expectNoCanvas();
  expect(scene.countRequestedSceneChunks()).toBe(0);
  await row.press('Enter');

  const worker = await context.newPage();
  await worker.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  await createPersonaRobot(worker).openAsPersona(WAREHOUSE_HASH, OPERATOR_PERSONA_ID);
  const receipt = worker.getByTestId('warehouse-receiving-task').and(worker.locator('[data-document-number="1"]'));
  await receipt.getByTestId('warehouse-claim-receiving').click();
  await receipt.getByTestId('warehouse-enter-sscc').click();
  await page.bringToFront();
  await scene.chooseGraphicsPreference('low');
  await scene.expectSceneState('ready');
  const map = page.getByTestId('top-bar-panels-toggle');
  await map.tap();
  await expect(map).toHaveAttribute('aria-pressed', 'true');
  const receiving = page.getByTestId(`warehouse-scene-staff-count-${RECEIVING_AREA_ID}`);
  const storage = page.getByTestId(`warehouse-scene-staff-count-${STORAGE_ZONE_ID}`);
  const avatar = page.getByTestId(`warehouse-scene-staff-avatar-${OPERATOR_STAFF_ID}`);
  await expect(receiving).toBeVisible();
  await expect(receiving).toContainText(/0\s*\/\s*2/u);
  await expect(receiving).toHaveAttribute('data-comparison', 'shortage');
  await expect(avatar).toHaveCount(0);

  const form = receipt.getByTestId('warehouse-receive-form');
  await scanCode(form, ']C100000000000000000017', true);
  await form.getByTestId('warehouse-receive-submit').click();
  const placement = receipt.getByTestId('warehouse-placement');
  await expect(placement).toBeVisible();
  await page.bringToFront();
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveAttribute('data-area-id', RECEIVING_AREA_ID);
  await expect(receiving).toContainText(/1\s*\/\s*2/u);
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_MS);
  const [receivingBox, storageBox] = await Promise.all([receiving.boundingBox(), storage.boundingBox()]);
  if (receivingBox === null || storageBox === null) {
    throw new Error('Both staff counters must be visible on the phone');
  }
  const hasGap = receivingBox.x + receivingBox.width <= storageBox.x || storageBox.x + storageBox.width <= receivingBox.x
    || receivingBox.y + receivingBox.height <= storageBox.y || storageBox.y + storageBox.height <= receivingBox.y;
  expect(hasGap).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('warehouse-operator-receiving-phone.png') });
  const box = await avatar.boundingBox();
  if (box === null) {
    throw new Error('The confirmed forklift operator is missing from the warehouse scene');
  }
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const dialog = page.getByTestId('warehouse-staff-scene-profile');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Нина Озерова');
  const profile = dialog.getByTestId('warehouse-staff-profile');
  await expect(profile.getByTestId('warehouse-staff-qualifications')).toBeVisible();
  await expect(profile.getByTestId('warehouse-staff-performance')).toBeVisible();
  const profileText = await profile.innerText();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(avatar).toBeFocused();
  await map.tap();
  await row.focus();
  await row.press('Enter');
  await expect(page.getByTestId('warehouse-staff-profile')).toHaveText(profileText, { useInnerText: true });
  await createWarehouseRobot(page).expectStaffCount(RECEIVING_AREA_ID, 1);

  await scanCode(placement, await placement.locator('select option').nth(1).innerText(), true);
  await placement.getByTestId('warehouse-place-unit').click();
  await expect(placement).toHaveCount(0);
  await createWarehouseRobot(page).expectStaffCount(STORAGE_ZONE_ID, 1);
  await map.tap();
  await expect(storage).toBeVisible();
  await expect(avatar).toHaveAttribute('data-area-id', STORAGE_ZONE_ID);
  await expect(storage).toContainText(/1\s*\/\s*1/u);
  await expect(storage).toHaveAttribute('data-comparison', 'balanced');
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_MS);
  expect(scene.readPageErrors()).toEqual([]);
});

test('selects the active worker among thirty trucks and returns to rest', async ({ context, page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize(DESKTOP_VIEWPORT);
  const control = await context.newPage();
  const { dockId, taskId } = await prepareYardVehicleMarkings(control, 30, 'day');
  const method = WarehouseReceivingService.method;
  const command = { ...YARD_MARKINGS_SCOPE, taskId };
  const manager = await createEngineWorkerRobot(control, DEAL_CUSTOMER);
  const assignment = await (async () => {
    const { tasks } = await callYardWorker(manager, method.listReceivingTasks, { ...YARD_MARKINGS_SCOPE, page: { pageSize: 100 } });
    const task = tasks.find(candidate => candidate.id === taskId);
    if (task === undefined) {
      throw new Error('The busy yard needs a delivery ready for the cold dock');
    }
    return callYardWorker(manager, method.assignYardVisitToDock, {
      ...command, expectedVersion: task.version, idempotencyKey: randomUUID(), reason: 'Приёмка паллеты', unloadingPointId: dockId,
    });
  })().finally(manager.stop);
  const worker = await createEngineWorkerRobot(control, { ...DEAL_CUSTOMER, userId: OPERATOR_STAFF_ID });
  try {
    const { task } = await callYardWorker(worker, method.claimReceivingTask, {
      ...command, expectedVersion: assignment.taskVersion, idempotencyKey: randomUUID(),
    });
    const unit = task?.expectedUnits[0];
    const batch = unit?.batches[0];
    const line = task?.orderLines.find(({ dealLineId }) => dealLineId === batch?.dealLineId);
    if (task === undefined || unit === undefined || batch === undefined || line === undefined) {
      throw new Error('The forklift operator needs a handling unit with a matching delivery line');
    }
    await callYardWorker(worker, method.receiveHandlingUnit, {
      ...command,
      expectedVersion: task.version,
      idempotencyKey: randomUUID(),
      unit: { case: 'unlabelledUnit', value: { expectedUnitId: unit.id, gtin: line.gtin, quantityBase: batch.quantityBase } },
    });
  }
  finally {
    await worker.stop();
  }
  await control.close();
  await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  await page.addInitScript(installYardMarkingSceneProbe, false);
  const scene = createSceneRobot(page);
  scene.watchPageErrors();
  await createPersonaRobot(page).openAsPersona(WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  await createAssistantRobot(page).dismissReplica('digest');
  await scene.chooseGraphicsPreference('low');
  await scene.expectSceneState('ready');
  await expect.poll(async () => (await readYardMarkingSceneProbe(page)).markedTruckInstances).toBe(30);
  const sceneToggle = page.getByTestId('warehouse-scene-view-toggle');
  await sceneToggle.click();
  await expect(sceneToggle).toHaveAttribute('aria-expanded', 'false');
  const avatar = page.getByTestId(`warehouse-scene-staff-avatar-${OPERATOR_STAFF_ID}`)
    .and(page.getByRole('button', { name: 'Нина Озерова' }));
  await expect(avatar).toHaveAttribute('data-area-id', RECEIVING_AREA_ID);
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_MS);
  const { lastFrameDrawCalls } = await readYardMarkingSceneProbe(page);
  expect(lastFrameDrawCalls).toBeGreaterThan(0);
  await testInfo.attach('warehouse-staff-draw-calls', {
    body: JSON.stringify({ graphics: 'low', lastFrameDrawCalls, trucks: 30 }),
    contentType: 'application/json',
  });
  await page.screenshot({ path: testInfo.outputPath('warehouse-operator-thirty-trucks.png') });
  await avatar.focus();
  await avatar.press('Enter');
  const dialog = page.getByTestId('warehouse-staff-scene-profile');
  await expect(dialog).toContainText('Нина Озерова');
  await expect(dialog.getByTestId('warehouse-staff-active')).toBeVisible();
  await dialog.getByTestId('warehouse-staff-scene-close').click();
  await expect(dialog).toHaveCount(0);
  await expect(avatar).toBeFocused();
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_MS);
  await sceneToggle.click();
  await expect(sceneToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('warehouse-receiving-task').first()).toBeVisible();
  expect(scene.readPageErrors()).toEqual([]);
});
