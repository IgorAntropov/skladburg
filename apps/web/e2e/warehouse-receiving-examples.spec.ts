import { expect } from '@playwright/test';
import { hasGs1CheckDigit } from '@skladburg/contracts/forms';

import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import {
  toObjectHash,
  toWarehouseRoute,
} from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import { PHONE_VIEWPORT } from './fixtures/viewports.ts';
import {
  installCameraTestFeed,
  openWarehouseCamera,
  showCameraCode,
} from './robots/camera-scan-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { openPrintPreview } from './robots/print-labels-robot.ts';
import { scanCode } from './robots/warehouse-delivery-robot.ts';

const REHEARSAL_WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(OWN_NETWORK_SITES[2].id));
const COTTAGE_SSCC = '000000000000000017';
const COTTAGE_GTIN = '2120000000201';
const YOGURT_SSCC = '000000000000000024';
const YOGURT_GTIN = '02000002999911';
const BATCH = 'DEMO-YOGURT';

test.use({ reducedMotion: 'reduce', viewport: PHONE_VIEWPORT });

test('receives a pallet without a label and prints its assigned SSCC in a fresh world', async ({ page }) => {
  await createPersonaRobot(page).openAsPersona(REHEARSAL_WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  const receiving = page.getByTestId('warehouse-receiving-task');
  await expect(receiving).toHaveCount(3);
  const task = receiving.first();
  await task.getByTestId('warehouse-claim-receiving').click();
  await task.getByTestId('warehouse-enter-sscc').click();
  const form = task.getByTestId('warehouse-receive-form');
  await scanCode(form, `]C100${COTTAGE_SSCC}`, true);
  await form.getByTestId('warehouse-receive-submit').click();

  const unlabelled = task.getByTestId('warehouse-receive-unit');
  await expect(unlabelled).toHaveCount(1);
  await unlabelled.click();
  await scanCode(form, COTTAGE_GTIN, true);
  await expect(form.locator('input[name="gtin"]')).toHaveValue(COTTAGE_GTIN);
  await form.locator('input[name="quantityBase"]').fill('50000');
  await form.getByTestId('warehouse-receive-submit').click();

  const placement = task.getByTestId('warehouse-placement');
  await expect(placement).toHaveCount(2);
  const label = await openPrintPreview(task.getByTestId('print-labels-open').nth(1));
  const printed = await label.getPages().locator('figcaption').innerText();
  const sscc = printed.replace(/^\(00\)\s+/u, '');
  expect(sscc).toMatch(/^\d{18}$/u);
  expect(sscc).not.toBe(COTTAGE_SSCC);
  expect(hasGs1CheckDigit(sscc)).toBe(true);
  await label.print();
  await label.close();

  const cell = placement.nth(1).locator('select option').nth(1);
  await scanCode(placement.nth(1), await cell.innerText(), true);
  await placement.nth(1).getByTestId('warehouse-place-unit').click();
  await expect(placement).toHaveCount(1);
  await scanCode(placement, await placement.locator('select option').nth(2).innerText(), true);
  await placement.getByTestId('warehouse-place-unit').click();
  await expect(placement).toHaveCount(0);
  await task.getByTestId('warehouse-finish-receiving').click();
  await expect(task.getByTestId('warehouse-finish-receiving')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('scans marked products and issues a discrepancy act when one DataMatrix is missing', async ({ page }) => {
  await installCameraTestFeed(page);
  await createPersonaRobot(page).openAsPersona(REHEARSAL_WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  const receiving = page.getByTestId('warehouse-receiving-task');
  await expect(receiving).toHaveCount(3);
  const task = receiving.nth(1);
  await task.getByTestId('warehouse-claim-receiving').click();
  await task.getByTestId('warehouse-receive-unit').click();
  const form = task.getByTestId('warehouse-receive-form');
  await expect(form.locator('input[name="sscc"]')).toHaveValue(YOGURT_SSCC);
  await form.getByTestId('warehouse-open-scanner').click();
  const camera = await openWarehouseCamera(form);
  await expect(camera.getByTestId('warehouse-camera-video')).toHaveJSProperty('readyState', 2);
  const marking = form.locator('input[name="markingCodes"]');
  const serials = ['DEMO101', 'DEMO102'];
  for (const serial of serials) {
    await showCameraCode(page, `(01)${YOGURT_GTIN}(21)${serial}(10)${BATCH}`, 'gs1datamatrix');
    await expect(marking).toHaveValue(new RegExp(serial, 'u'));
  }
  await expect(marking).toHaveValue(serials.map(serial => `01${YOGURT_GTIN}21${serial}\u001D10${BATCH}`).join(' '));
  await camera.getByTestId('warehouse-camera-close').click();
  await expect(form.getByTestId('warehouse-camera-open')).toBeFocused();
  await form.getByTestId('warehouse-scan-input').locator('input').focus();
  const repeated = await scanCode(form, `]d201${YOGURT_GTIN}21DEMO101`);
  await expect(repeated).toHaveAttribute('aria-invalid', 'true');
  await form.getByTestId('warehouse-receive-submit').click();
  await task.getByTestId('warehouse-finish-receiving').click();
  await task.locator('a[href^="#/deals/"]').click();
  const receipt = page.getByTestId('deal-warehouse-receipt');
  await expect(receipt.getByTestId('deal-receipt-open-claim')).toBeVisible();
  await expect(receipt.locator('a[href^="#/documents/"]')).toHaveCount(2);
});
