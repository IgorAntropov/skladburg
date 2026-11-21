import type {
  Locator,
  Page,
} from '@playwright/test';
import type { YardDispatchEntry } from '@skladburg/contracts/wms/v1/receiving';

import {
  WarehouseReceivingService,
  YardDispatchAction,
  YardDispatchOutcome,
  YardPriorityFactor,
} from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
import { WarehouseEquipmentStatus } from '@skladburg/contracts/wms/v1/warehouse_equipment';
import { WAREHOUSE_YARD_MORNING } from '@skladburg/demo-engine/client';

import { expectNoAxeViolations } from './fixtures/axe.ts';
import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
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
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createProfileMenuLocators } from './robots/profile-menu-locators.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

const SCOPE = { warehouseId: OWN_NETWORK_SITES[2].id };
const WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(SCOPE.warehouseId));
const { method } = WarehouseReceivingService;
const PROMOTE_REASON = 'Срочная выгрузка длинномера к началу смены';
const ASSIGN_REASON = 'Подать охлаждённый груз к холодной рампе';

const openProfileAction = async (page: Page, testId: string): Promise<void> => {
  const { button, menu } = createProfileMenuLocators(page);
  const action = menu.getByTestId(testId);
  await button.click();
  await expect(action).toBeVisible();
  await action.click();
};

const visit = (page: Page, taskId: string): Locator =>
  page.getByTestId('yard-dispatch-visit').and(page.locator(`[data-task-id="${taskId}"]`));

const waitingVisits = (page: Page): Locator => page.getByTestId('yard-dispatch-visit')
  .and(page.locator('[data-yard-state="queue"], [data-yard-state="blocked"], [data-yard-state="slot"]'));

const reasonInput = (page: Page): Locator => page.getByTestId('yard-dispatch-reason').locator('input');

const confirmDispatch = async (page: Page): Promise<void> => {
  await page.getByTestId('yard-dispatch-submit').click();
  await expect(page.getByTestId('yard-dispatch-result')).toBeVisible();
};

const expectDock = async (task: Locator, code: string): Promise<void> => {
  await expect(task).toHaveAttribute('data-yard-state', 'assigned');
  await expect(task.getByTestId('yard-dispatch-visit-dock')).toContainText(code);
};

test.use({ reducedMotion: 'reduce', viewport: DESKTOP_VIEWPORT });

test('replays the morning yard from the profile without resetting the ordinary world', async ({ browserName, context, page }) => {
  test.setTimeout(90_000);
  if (browserName === 'webkit') {
    await page.setViewportSize(PHONE_VIEWPORT);
  }
  await createPersonaRobot(page).openAsPersona('#/network', PERSONAS.freshSupplier.id);
  await openProfileAction(page, 'profile-menu-yard-morning');
  await expect(page.getByTestId('warehouse-yard-dispatch')).toBeVisible();
  await expect(waitingVisits(page)).toHaveCount(25);
  await expect(page.getByTestId('yard-waiting-reason').and(page.locator('[data-reason="WAITING_DOCUMENTS"]'))).toHaveCount(23);

  const standard = await context.newPage();
  await createPersonaRobot(standard).openAsPersona(WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  const standardReceipts = standard.getByTestId('warehouse-receiving-task');
  await expect(standardReceipts).toHaveCount(3);
  const standardReceipt = standardReceipts.first();
  await standardReceipt.getByTestId('warehouse-claim-receiving').click();
  await expect(standardReceipt.getByTestId('warehouse-enter-sscc')).toBeVisible();

  const control = await context.newPage();
  const reader = await createEngineWorkerRobot(control, DEAL_CUSTOMER, './', WAREHOUSE_YARD_MORNING);
  const readJournal = async (): Promise<YardDispatchEntry[]> =>
    (await callYardWorker(reader, method.listYardDispatchEntries, SCOPE)).entries;

  try {
    await expect.poll(reader.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    const [{ topology }, { reasons }] = await Promise.all([
      callYardWorker(reader, WarehouseTopologyService.method.getWarehouseTopology, SCOPE),
      callYardWorker(reader, method.listYardWaitingReasons, SCOPE),
    ]);
    const area = topology?.receivingArea;
    const docks = [area?.unloadingPoint, ...area?.additionalUnloadingPoints ?? []];
    expect(docks.map(dock => dock?.code)).toEqual(['D01', 'D02', 'D03', 'D04', 'D05', 'D06']);
    const coldDock = docks.find(dock => dock?.code === 'D06');
    const wideDock = docks.find(dock => dock?.code === 'D04');
    const longLoad = reasons.find(reason => (reason.queuePosition ?? 0) > 1
      && reason.priorityFactors.includes(YardPriorityFactor.EXPLICIT_URGENCY) && reason.dispatchOptions?.canPromote === true);
    const coldLoad = reasons.find(reason => reason.priorityFactors.includes(YardPriorityFactor.COLD_CARGO));
    if (coldDock === undefined || coldLoad === undefined || longLoad === undefined || wideDock === undefined) {
      throw new Error('The morning scenario needs cold and wide docks and two dispatchable visits');
    }

    if (browserName === 'chromium') {
      await expectNoAxeViolations(page);
    }
    const coldVisit = visit(page, coldLoad.receivingTaskId);
    const longVisit = visit(page, longLoad.receivingTaskId);
    await expect(longVisit).toHaveAttribute('data-queue-position', String(longLoad.queuePosition));
    await longVisit.getByTestId('yard-dispatch-select').click();
    await longVisit.getByTestId('yard-dispatch-promote').click();
    await reasonInput(page).fill(PROMOTE_REASON);
    await confirmDispatch(page);
    await expectDock(longVisit, 'D04');
    await expectDock(coldVisit, 'D06');
    await expect.poll(readJournal).toMatchObject([{
      action: YardDispatchAction.PROMOTE,
      after: { unloadingPointId: wideDock.id },
      outcome: YardDispatchOutcome.DOCK_ASSIGNED,
      reason: PROMOTE_REASON,
      taskId: longLoad.receivingTaskId,
    }]);

    await page.reload();
    await expectDock(longVisit, 'D04');
    await expectDock(coldVisit, 'D06');
    await expect(waitingVisits(page)).toHaveCount(23);

    await page.goto('./#/network');
    await expect(page.getByTestId('page-network')).toBeVisible();
    const topBar = createTopBarRobot(page);
    await topBar.requestReset();
    await topBar.resetFromConfirm();
    await topBar.expectResetConfirmClosed();
    await expect(page.getByTestId('warehouse-yard-dispatch')).toBeVisible();
    await expect(waitingVisits(page)).toHaveCount(25);
    await expect(longVisit).toHaveAttribute('data-queue-position', String(longLoad.queuePosition));
    await expect.poll(readJournal).toEqual([]);

    await standard.reload();
    await expect(standardReceipts).toHaveCount(3);
    await expect(standardReceipt.getByTestId('warehouse-enter-sscc')).toBeVisible();

    await coldVisit.getByTestId('yard-dispatch-select').click();
    await coldVisit.getByTestId('yard-dispatch-assign').click();
    await page.getByTestId('yard-dispatch-dock').locator('select').selectOption(coldDock.id);
    await reasonInput(page).fill(ASSIGN_REASON);
    await openProfileAction(page, 'profile-menu-yard-morning-exit');
    await expect(page.getByTestId('yard-dispatch-discard')).toBeVisible();
    await page.getByTestId('yard-dispatch-discard-stay').click();
    await expect(reasonInput(page)).toHaveValue(ASSIGN_REASON);
    await confirmDispatch(page);
    await expectDock(coldVisit, 'D06');
    await expect.poll(readJournal).toMatchObject([{
      action: YardDispatchAction.ASSIGN_DOCK,
      after: { unloadingPointId: coldDock.id },
      reason: ASSIGN_REASON,
      taskId: coldLoad.receivingTaskId,
    }]);
    await createWarehouseRobot(page).openEquipmentTab();
    const station = page.getByTestId(/^warehouse-equipment-station-/u);
    await expect(station).toHaveAttribute('data-equipment-id', /.+/u);
    const chargingId = await station.getAttribute('data-equipment-id') ?? '';
    const status = page.getByTestId(`warehouse-equipment-status-${chargingId}`);
    await expect(status).toHaveAttribute('data-status', String(WarehouseEquipmentStatus.CHARGING));
    await page.getByTestId(`warehouse-equipment-open-${chargingId}`).click();
    const inspector = page.getByTestId('warehouse-equipment-inspector');
    await expect(inspector.getByTestId('warehouse-equipment-inspector-station')).toContainText('ЗС-01');
    await inspector.getByTestId('warehouse-equipment-close').click();
    await createSceneRobot(page).expectNoCanvas();

    await openProfileAction(page, 'profile-menu-yard-morning-exit');
    await expect(page.getByTestId('page-network')).toBeVisible();
    const { button, getPersonaItem, menu } = createProfileMenuLocators(page);
    await button.click();
    await expect(menu.getByTestId('profile-menu-yard-morning')).toBeVisible();
    await expect(getPersonaItem(PERSONAS.freshSupplier)).toHaveAttribute('aria-checked', 'true');
    await getPersonaItem(PERSONAS.freshCustomer).click();
    await expect(menu).toHaveCount(0);
    await createPersonaRobot(page).expectCurrentPersona(PERSONAS.freshCustomer);
    await page.goto(`./${WAREHOUSE_HASH}`);
    const receiptsAfterExit = page.getByTestId('warehouse-receiving-task');
    await expect(receiptsAfterExit).toHaveCount(3);
    await expect(receiptsAfterExit.first().getByTestId('warehouse-enter-sscc')).toBeVisible();
  }
  finally {
    await reader.stop();
  }
});
