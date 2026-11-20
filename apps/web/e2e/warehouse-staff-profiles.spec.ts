import type { Page } from '@playwright/test';

import { expectNoAxeViolations } from './fixtures/axe.ts';
import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import {
  toObjectHash,
  toSectionHash,
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
import { createPersonaRobot } from './robots/persona-robot.ts';
import { scanCode } from './robots/warehouse-delivery-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

const WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(OWN_NETWORK_SITES[2].id));
const LEAD = { personaId: '90000031-0000-4000-8000-000000000000', staffId: '20000031-0000-4000-8000-000000000000' };
const OPERATOR = { personaId: '90000032-0000-4000-8000-000000000000', staffId: '20000032-0000-4000-8000-000000000000' };
const PICKER = { personaId: '90000033-0000-4000-8000-000000000000', staffId: '20000033-0000-4000-8000-000000000000' };
const COMPANY_ADMIN_PERSONA_ID = '90000034-0000-4000-8000-000000000000';
const FORKLIFT_RECEIPT = '1';

const openProfile = async (page: Page, staffId: string): Promise<void> => {
  await page.getByTestId(`warehouse-staff-open-${staffId}`).click();
  await expect(page.getByTestId('warehouse-staff-profile')).toBeVisible();
};

test.use({ reducedMotion: 'reduce', viewport: DESKTOP_VIEWPORT });

test('keeps an expired forklift operator off the task and updates the qualified operator’s open profile across tabs', async ({
  browserName, context, page,
}) => {
  test.setTimeout(90_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  await createPersonaRobot(page).openAsPersona(WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  await createWarehouseRobot(page).openStaffTab();
  await openProfile(page, OPERATOR.staffId);
  const active = page.getByTestId('warehouse-staff-active');
  const history = page.getByTestId('warehouse-staff-history');
  const activeReceipt = active.getByText(FORKLIFT_RECEIPT, { exact: true });
  const finishedReceipt = history.getByText(FORKLIFT_RECEIPT, { exact: true });
  const metrics = page.getByTestId('warehouse-staff-performance').locator('dd');
  await expect(page.getByTestId('warehouse-staff-qualifications')).toBeVisible();
  await expect(metrics).toHaveText(['0', '0', 'Нет данных', 'Нет данных']);
  await expect(active).toBeVisible();
  await expect(history).toBeVisible();
  await expect(activeReceipt).toHaveCount(0);
  await expect(finishedReceipt).toHaveCount(0);
  if (browserName === 'chromium') {
    await expectNoAxeViolations(page);
  }

  const worker = await context.newPage();
  await worker.setViewportSize(PHONE_VIEWPORT);
  await worker.addInitScript({ content: createStoreSystemThemeScript() });
  await worker.emulateMedia({ colorScheme: 'dark' });
  const workerPersona = createPersonaRobot(worker);
  await workerPersona.openAsPersona(WAREHOUSE_HASH, PICKER.personaId);
  const task = worker.getByTestId('warehouse-receiving-task').and(worker.locator(`[data-document-number="${FORKLIFT_RECEIPT}"]`));
  const claim = task.getByTestId('warehouse-claim-receiving');
  await claim.click();
  await expect(task.getByRole('alert')).toContainText('Срок допуска');
  await expect(claim).toBeEnabled();
  await expect(activeReceipt).toHaveCount(0);

  await workerPersona.selectPersona({ ...PERSONAS.freshStorekeeper, id: OPERATOR.personaId });
  await claim.click();
  await expect(activeReceipt).toBeVisible();
  await task.getByTestId('warehouse-enter-sscc').click();
  const form = task.getByTestId('warehouse-receive-form');
  await scanCode(form, ']C100000000000000000017', true);
  await form.getByTestId('warehouse-receive-submit').click();
  const remaining = task.getByTestId('warehouse-receive-unit');
  await expect(remaining).toHaveCount(1);
  await remaining.click();
  await scanCode(form, '2120000000201', true);
  await form.locator('input[name="quantityBase"]').fill('50000');
  await form.getByTestId('warehouse-receive-submit').click();
  await expect(remaining).toHaveCount(0);
  await task.getByTestId('warehouse-finish-receiving').click();
  await expect(finishedReceipt).toBeVisible();
  await expect(metrics).toHaveText(['1', '1', 'Нет данных', 'Нет данных']);
  await expect(activeReceipt).toHaveCount(0);
  await expect(worker.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(worker.locator('canvas')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('opens only the permitted profile fields from a work area and from the company administrator’s directory', async ({ page }) => {
  const persona = createPersonaRobot(page);
  await page.setViewportSize(PHONE_VIEWPORT);
  await persona.openAsPersona(WAREHOUSE_HASH, OPERATOR.personaId);
  await page.getByTestId('warehouse-task-staff').click();
  const ownProfile = page.getByTestId(`warehouse-staff-open-${OPERATOR.staffId}`);
  await ownProfile.focus();
  await ownProfile.press('Enter');
  await expect(ownProfile).toBeFocused();
  await expect(ownProfile).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('warehouse-staff-qualifications')).toBeVisible();
  await expect(page.getByTestId('warehouse-staff-performance')).toBeVisible();
  await expect(page.getByTestId(`warehouse-staff-open-${PICKER.staffId}`)).toHaveCount(0);
  await openProfile(page, LEAD.staffId);
  await expect(page.getByTestId('warehouse-staff-active')).toBeVisible();
  await expect(page.getByTestId('warehouse-staff-qualifications')).toHaveCount(0);
  await expect(page.getByTestId('warehouse-staff-performance')).toHaveCount(0);
  await expect(page.getByTestId('warehouse-staff-history')).toHaveCount(0);

  await persona.selectPersona({ ...PERSONAS.freshStorekeeper, id: LEAD.personaId });
  await page.getByTestId('warehouse-task-staff').click();
  await openProfile(page, OPERATOR.staffId);
  await expect(page.getByTestId('warehouse-staff-qualifications')).toBeVisible();
  await expect(page.getByTestId('warehouse-staff-performance')).toBeVisible();
  await openProfile(page, PICKER.staffId);
  await expect(page.getByTestId('warehouse-staff-active')).toBeVisible();
  await expect(page.getByTestId('warehouse-staff-qualifications')).toHaveCount(0);
  await expect(page.getByTestId('warehouse-staff-history')).toHaveCount(0);

  await persona.selectPersona({ ...PERSONAS.freshCustomer, id: COMPANY_ADMIN_PERSONA_ID });
  await page.goto(`./${toSectionHash('warehouse')}`);
  await openProfile(page, OPERATOR.staffId);
  await expect(page.getByTestId('warehouse-staff-qualifications')).toBeVisible();
  await expect(page.getByTestId('warehouse-staff-active')).toHaveCount(0);
  await expect(page.getByTestId('warehouse-staff-performance')).toHaveCount(0);
  await expect(page.getByTestId('warehouse-staff-history')).toHaveCount(0);
  await expect(page.getByTestId('warehouse-list-item')).toHaveCount(0);
});
