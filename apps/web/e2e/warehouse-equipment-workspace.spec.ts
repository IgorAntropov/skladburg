import { WarehouseEquipmentStatus } from '@skladburg/contracts/wms/v1/warehouse_equipment';

import { expectNoAxeViolations } from './fixtures/axe.ts';
import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
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
import { createAssistantRobot } from './robots/assistant-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import { scanCode } from './robots/warehouse-delivery-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

const WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(OWN_NETWORK_SITES[2].id));
const FORKLIFT_ID = '8e000001-0000-4000-8000-000000000001';
const STATION_ID = '8e000002-0000-4000-8000-000000000001';
const DRIVER_PERSONA_ID = '90000032-0000-4000-8000-000000000000';
const DRIVER_STAFF_ID = '20000032-0000-4000-8000-000000000000';
const BUYER_PERSONA_ID = '90000009-0000-4000-8000-000000000000';

test.use({ reducedMotion: 'reduce', viewport: DESKTOP_VIEWPORT });

test('follows the forklift from receiving to full charge across tabs and respects the current viewer', async ({
  browserName, context, page,
}, testInfo) => {
  test.setTimeout(90_000);
  const theme = browserName === 'webkit' ? 'dark' : 'light';
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.emulateMedia({ colorScheme: theme });
  if (browserName === 'webkit') {
    await page.setViewportSize(PHONE_VIEWPORT);
  }
  const scene = createSceneRobot(page);
  scene.watchSceneChunkRequests();
  const persona = createPersonaRobot(page);
  const warehouse = createWarehouseRobot(page);
  await persona.openAsPersona(WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  await createAssistantRobot(page).dismissReplica('digest');
  await warehouse.openEquipmentTab();
  const list = page.getByTestId('warehouse-equipment-list');
  const unit = list.getByTestId(`warehouse-equipment-open-${FORKLIFT_ID}`);
  const station = page.getByTestId(`warehouse-equipment-station-${STATION_ID}`);
  await expect(list.getByTestId(/^warehouse-equipment-open-/u)).toHaveCount(2);
  await expect(unit).toContainText('ПГ-01');
  await expect(list.getByTestId(`warehouse-equipment-battery-${FORKLIFT_ID}`)).toHaveAttribute('data-percent', '20');
  await expect(list.getByTestId(`warehouse-equipment-status-${FORKLIFT_ID}`))
    .toHaveAttribute('data-status', String(WarehouseEquipmentStatus.AVAILABLE));
  await expect(station).toContainText('ЗС-01');
  await expect(station).not.toHaveAttribute('data-equipment-id', /.+/u);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.screenshot({ path: testInfo.outputPath('warehouse-equipment-list.png') });
  await unit.focus();
  await unit.press('Enter');
  const inspector = page.getByTestId('warehouse-equipment-inspector');
  const battery = inspector.getByTestId('warehouse-equipment-inspector-battery');
  const status = inspector.getByTestId('warehouse-equipment-inspector-status');
  const driver = inspector.getByTestId('warehouse-equipment-driver');
  const assignment = inspector.getByTestId('warehouse-equipment-task');
  await expect(inspector).toContainText('Складовой ЭП-20');
  await expect(driver).toHaveCount(0);
  await expect(assignment).toHaveCount(0);

  const operator = await context.newPage();
  await createPersonaRobot(operator).openAsPersona(WAREHOUSE_HASH, DRIVER_PERSONA_ID);
  const receipt = operator.getByTestId('warehouse-receiving-task').and(operator.locator('[data-document-number="1"]'));
  await receipt.getByTestId('warehouse-claim-receiving').click();
  await expect(status).toHaveAttribute('data-status', String(WarehouseEquipmentStatus.TO_TASK));
  await expect(driver).toHaveAttribute('data-staff-id', DRIVER_STAFF_ID);
  await expect(driver).toContainText('Нина Озерова');
  await expect(assignment).toHaveAttribute('data-task-id', /.+/u);
  await page.screenshot({ path: testInfo.outputPath('warehouse-equipment-working.png') });
  if (browserName === 'chromium') {
    await expectNoAxeViolations(page);
  }
  await page.keyboard.press('Escape');
  await expect(inspector).toHaveCount(0);
  await expect(unit).toBeFocused();

  await persona.selectPersona({ ...PERSONAS.freshCustomer, id: BUYER_PERSONA_ID });
  await page.goto(`./${WAREHOUSE_HASH}`);
  await warehouse.openEquipmentTab();
  await unit.click();
  await expect(status).toHaveAttribute('data-status', String(WarehouseEquipmentStatus.TO_TASK));
  await expect(driver).toHaveCount(0);
  await expect(assignment).toHaveCount(0);
  await expect(inspector).not.toContainText('Нина Озерова');
  await receipt.getByTestId('warehouse-enter-sscc').click();
  const form = receipt.getByTestId('warehouse-receive-form');
  await scanCode(form, ']C100000000000000000017', true);
  await form.getByTestId('warehouse-receive-submit').click();
  await expect(status).toHaveAttribute('data-status', String(WarehouseEquipmentStatus.HANDLING));
  await receipt.getByTestId('warehouse-receive-unit').click();
  await scanCode(form, '2120000000201', true);
  await form.locator('input[name="quantityBase"]').fill('50000');
  await form.getByTestId('warehouse-receive-submit').click();
  await receipt.getByTestId('warehouse-finish-receiving').click();
  await expect(status).toHaveAttribute('data-status', String(WarehouseEquipmentStatus.CHARGING));
  await expect(inspector.getByTestId('warehouse-equipment-inspector-station')).toHaveAttribute('data-station-id', STATION_ID);
  await expect(station).toHaveAttribute('data-equipment-id', FORKLIFT_ID);

  const advance = await freezeEngineClock(page, operator);
  await advance(120 * 60_000);
  await expect(battery).toHaveAttribute('data-percent', '100');
  await expect(status).toHaveAttribute('data-status', String(WarehouseEquipmentStatus.AVAILABLE));
  await expect(inspector.getByTestId('warehouse-equipment-inspector-station')).toHaveCount(0);
  await expect(station).not.toHaveAttribute('data-equipment-id', /.+/u);
  await inspector.getByTestId('warehouse-equipment-close').click();
  await expect(unit).toBeFocused();
  await page.goto(`./${toObjectHash(toWarehouseRoute(OWN_NETWORK_SITES[0].id))}`);
  await warehouse.openEquipmentTab();
  await expect(page.getByTestId('warehouse-equipment-empty')).toBeVisible();
  await expect(unit).toHaveCount(0);
  await expect(station).toHaveCount(0);
  await scene.expectNoCanvas();
  expect(scene.countRequestedSceneChunks()).toBe(0);
});
