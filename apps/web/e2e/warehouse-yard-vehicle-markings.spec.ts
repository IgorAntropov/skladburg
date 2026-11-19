import type {
  Locator,
  Page,
} from '@playwright/test';

import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import { WarehouseReceivingService } from '@skladburg/contracts/wms/v1/receiving';

import { PERSONAS } from './fixtures/demoData.ts';
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
import { PHONE_VIEWPORT } from './fixtures/viewports.ts';
import { callYardWorker } from './fixtures/yardPolicyQueue.ts';
import {
  openYardVehicleMarkings,
  prepareYardVehicleMarkings,
  YARD_MARKINGS_SCOPE,
} from './fixtures/yardVehicleMarkings.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

const OBSERVER = { ...DEAL_CUSTOMER, userId: '20000010-0000-4000-8000-000000000000' };
const OUTSIDER = { organizationId: '10000008-0000-4000-8000-000000000000', userId: '20000008-0000-4000-8000-000000000000' };
const OUT_OF_WAREHOUSE_TASK_ID = 'ff910000-0000-4000-8000-000000000099';
const SCENE_ASSET = /\/assets\/(?:SceneRoot|WarehouseWorldScene|WarehouseYard(?:\w+Layer|Markings)|warehouse-scene|qualityLevel)/u;

const visit = (page: Page, taskId: string): Locator =>
  page.getByTestId('yard-dispatch-visit').and(page.locator(`[data-task-id="${taskId}"]`));

const registration = (page: Page, taskId: string): Locator => visit(page, taskId).getByTestId('warehouse-yard-registration');

const tab = (page: Page): Locator => page.getByRole('tab').and(page.locator('[id$="-trigger-yard"]'));

test.use({ initialGraphicsPreference: 'off', viewport: PHONE_VIEWPORT });

test('projects confirmed plates to allowed warehouse viewers across two tabs without 3D', async ({ context, page }) => {
  test.setTimeout(90_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  await context.addInitScript({ content: createStoreSystemThemeScript() });
  const control = await context.newPage();
  const fixture = await prepareYardVehicleMarkings(control, 25, 'day');
  const worker = await createEngineWorkerRobot(control, DEAL_CUSTOMER);
  const colleague = await context.newPage();
  const foreignViewer = await context.newPage();
  const observer = await createEngineWorkerRobot(await context.newPage(), OBSERVER);
  const outsider = await createEngineWorkerRobot(await context.newPage(), OUTSIDER);
  const { listYardVehicleMarkings } = WarehouseReceivingService.method;
  const requests: string[] = [];
  const scenes = [page, colleague, foreignViewer].map(createSceneRobot);
  if (fixture.unassignedTaskId === undefined) {
    throw new Error('The batch must include a direct delivery without an assigned vehicle');
  }
  const { unassignedTaskId } = fixture;
  const input = { ...YARD_MARKINGS_SCOPE, taskIds: [fixture.taskId, unassignedTaskId, OUT_OF_WAREHOUSE_TASK_ID] };
  try {
    const { markings } = await callYardWorker(worker, listYardVehicleMarkings, input);
    const own = markings.find(({ taskId }) => taskId === fixture.taskId);
    const unassigned = markings.find(({ taskId }) => taskId === unassignedTaskId);
    expect(own).toMatchObject({ brand: { name: PERSONAS.freshCarrier.organizationName }, registrationNumber: fixture.registrationNumber });
    expect(unassigned?.brand?.name).toBeTruthy();
    expect(unassigned?.registrationNumber).toBeUndefined();
    expect(markings.some(({ taskId }) => taskId === OUT_OF_WAREHOUSE_TASK_ID)).toBe(false);

    const denied = await callYardWorker(observer, listYardVehicleMarkings, input);
    expect(denied.markings.every(({ registrationNumber }) => registrationNumber === undefined)).toBe(true);
    expect(denied.markings.find(({ taskId }) => taskId === fixture.taskId)?.brand).toBeUndefined();
    const methodPath = `${listYardVehicleMarkings.parent.typeName}/${listYardVehicleMarkings.name}`;
    const encoded = toBinary(listYardVehicleMarkings.input, create(listYardVehicleMarkings.input, input));
    const foreign = await outsider.request(methodPath, encoded);
    expect([403, 404]).toContain(foreign.status);

    for (const current of [page, colleague, foreignViewer]) {
      current.on('request', request => requests.push(new URL(request.url()).pathname));
    }
    for (const scene of scenes) {
      scene.watchPageErrors();
    }
    await Promise.all([openYardVehicleMarkings(page), openYardVehicleMarkings(colleague)]);
    await expect(registration(page, fixture.taskId)).toHaveText(fixture.registrationNumber);
    await expect(registration(colleague, fixture.taskId)).toHaveText(fixture.registrationNumber);
    await expect(registration(page, unassignedTaskId)).toHaveCount(0);
    await visit(page, fixture.taskId).getByTestId('yard-dispatch-select').press('Enter');
    await page.getByTestId('yard-dispatch-assign').press('Enter');
    await page.getByTestId('yard-dispatch-dock').getByRole('combobox').selectOption(fixture.dockId);
    await page.getByTestId('yard-dispatch-reason').getByRole('textbox').fill('Подача на свободную рампу');
    await page.getByTestId('yard-dispatch-submit').press('Enter');
    await expect(visit(colleague, fixture.taskId)).toHaveAttribute('data-yard-state', 'assigned');
    await expect(registration(colleague, fixture.taskId)).toHaveText(fixture.registrationNumber);
    await colleague.reload();
    await tab(colleague).press('Enter');
    await expect(registration(colleague, fixture.taskId)).toHaveText(fixture.registrationNumber);
    await colleague.emulateMedia({ colorScheme: 'dark' });
    await createSceneRobot(colleague).expectThemeAttribute('dark');
    await expect(registration(colleague, fixture.taskId)).toBeVisible();

    await createPersonaRobot(page).selectPersona(PERSONAS.freshStorekeeper);
    await expect(page.getByText(fixture.registrationNumber, { exact: true })).toHaveCount(0);
    await openYardVehicleMarkings(page, PERSONAS.freshStorekeeper.id);
    await expect(visit(page, fixture.taskId)).toBeVisible();
    await expect(registration(page, fixture.taskId)).toHaveCount(0);
    const foreignHash = toObjectHash(toWarehouseRoute(YARD_MARKINGS_SCOPE.warehouseId));
    await createPersonaRobot(foreignViewer).openAsPersona(foreignHash, PERSONAS.constructionCustomer.id);
    await expect(foreignViewer.getByTestId('warehouse-object-unavailable')).toBeVisible();
    await expect(foreignViewer.getByText(fixture.registrationNumber, { exact: true })).toHaveCount(0);
    for (const scene of scenes) {
      await scene.expectNoCanvas();
      expect(scene.readPageErrors()).toEqual([]);
    }
    expect(requests.filter(path => SCENE_ASSET.test(path))).toEqual([]);
  }
  finally {
    await Promise.all([worker.stop(), observer.stop(), outsider.stop()]);
  }
});
