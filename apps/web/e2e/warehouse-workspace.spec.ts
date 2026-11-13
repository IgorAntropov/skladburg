import type { Locator } from '@playwright/test';

import { expect } from '@playwright/test';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { DocumentType } from '@skladburg/contracts/document/v1/document';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';

import { expectNoAxeViolations } from './fixtures/axe.ts';
import {
  GOLDEN_APPLES,
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { freezeEngineClock } from './fixtures/engineClock.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import {
  toObjectHash,
  toSectionHash,
  toWarehouseRoute,
} from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import { toListingRoute } from './robots/catalog-robot.ts';
import { createDealFolderRobot } from './robots/deal-folder-robot.ts';
import { createDealRobot } from './robots/deal-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const SUPPLIER_WAREHOUSE_ID = '80000011-0000-4000-8000-000000000000';
const MINUTE_MS = 60_000;
const ORDER_DATE = '2026-10-12';
const CUSTOMER_WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(OWN_NETWORK_SITES[0].id));
const SUPPLIER_WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(SUPPLIER_WAREHOUSE_ID));

const scanCode = async (surface: Locator, code: string, isOpening = false): Promise<Locator> => {
  if (isOpening) {
    await surface.getByTestId('warehouse-open-scanner').click();
  }
  const input = surface.getByTestId('warehouse-scan-input').locator('input');
  await expect(input).toBeFocused();
  await input.pressSequentially(code);
  await input.press('Enter');

  return input;
};

test.use({ reducedMotion: 'reduce', viewport: DESKTOP_VIEWPORT });

test('picks and receives a seeded delivery through the warehouse workspace without 3D', async ({ browserName, context, page }) => {
  test.setTimeout(120_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  const supplierPage = await context.newPage();
  const storePage = await context.newPage();
  await storePage.setViewportSize(PHONE_VIEWPORT);
  await storePage.emulateMedia({ colorScheme: 'dark' });
  const customer = createDealRobot(page);
  const supplier = createDealRobot(supplierPage);
  const customerFolder = createDealFolderRobot(page);
  const supplierFolder = createDealFolderRobot(supplierPage);
  const storekeeper = createPersonaRobot(storePage);

  await createPersonaRobot(page).openAsPersona(toObjectHash(toListingRoute(GOLDEN_APPLES.id)), PERSONAS.freshCustomer.id);
  await createPersonaRobot(supplierPage).openAsPersona(toSectionHash('deals'), PERSONAS.freshSupplier.id);
  await storekeeper.openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshStorekeeper.id);
  await expect(page.getByTestId('order-open')).toBeVisible();
  await expect(supplierPage.getByTestId('deals-board')).toBeVisible();
  await expect(storePage.getByTestId('warehouse-workspace')).toBeVisible();
  await expect(storePage.locator('canvas')).toHaveCount(0);
  const advanceClock = await freezeEngineClock(page, supplierPage, storePage);

  const address = await customer.createDraft(OWN_NETWORK_SITES[0].id, '480', ORDER_DATE);
  await customer.submitDraft();
  await supplier.openReceivedNotification(address);
  await supplier.confirm(SUPPLIER_WAREHOUSE_ID);
  await customer.expectStatus(DealStatus.AGREED);
  await customer.choosePickup();

  for (const type of [DocumentType.SUPPLY_CONTRACT, DocumentType.SPECIFICATION, DocumentType.INVOICE]) {
    await supplierFolder.openDocument(type);
    await supplierFolder.signDocument();
    await supplierFolder.closeDocument();
    await customerFolder.openDocument(type);
    await customerFolder.signDocument();
    await customerFolder.closeDocument();
  }

  await customerFolder.fund();
  await customerFolder.expectPayment(SafeDealPaymentStatus.AWAITING_FUNDS);
  await advanceClock(5 * MINUTE_MS);
  await supplier.expectStatus(DealStatus.PAID);
  await expect(supplierPage.getByTestId('deal-mark-shipped')).toHaveCount(0);
  await supplierPage.getByTestId('deal-open-warehouse').click();
  await expect.poll(() => new URL(supplierPage.url()).hash).toBe(SUPPLIER_WAREHOUSE_HASH);
  const picking = supplierPage.getByTestId('warehouse-picking-task');
  await picking.getByTestId('warehouse-claim-picking').click();
  const unit = picking.getByTestId('warehouse-pick-unit');
  await expect(unit).toHaveCount(1);
  const sscc = await picking.getByText(/^\d{18}$/u).innerText();
  await expect(picking.getByTestId('warehouse-confirm-picking')).toBeDisabled();
  const pickInput = await scanCode(picking, ']C100000000000000000024', true);
  await expect(pickInput).toHaveAttribute('aria-invalid', 'true');
  await expect(unit).toHaveAttribute('aria-pressed', 'false');
  await scanCode(picking, `]C100${sscc}`);
  await expect(unit).toHaveAttribute('aria-pressed', 'true');
  await scanCode(picking, sscc);
  await expect(pickInput).toHaveAttribute('aria-invalid', 'true');
  await expect(unit).toHaveAttribute('aria-pressed', 'true');
  await picking.getByTestId('warehouse-confirm-picking').click();
  await picking.getByTestId('warehouse-confirm-shipment').click();

  await customer.expectStatus(DealStatus.SHIPPED, DealStatus.IN_TRANSIT);
  await advanceClock(2 * MINUTE_MS);
  await customer.expectStatus(DealStatus.ARRIVED);
  await expect(page.getByTestId('deal-accept')).toHaveCount(0);
  const workspace = storePage.getByTestId('warehouse-workspace');
  const receiving = storePage.getByTestId('warehouse-receiving-task');
  await receiving.getByTestId('warehouse-claim-receiving').click();
  await receiving.getByTestId('warehouse-enter-sscc').click();
  const receive = receiving.getByTestId('warehouse-receive-form');
  const ssccInput = receive.locator('input[name="sscc"]');
  await expect(ssccInput).toBeFocused();
  if (browserName === 'chromium') {
    await expectNoAxeViolations(storePage);
  }
  await ssccInput.fill(sscc.slice(0, -1));
  await workspace.locator(`a[href="${toSectionHash('warehouse')}"]`).click();
  await expect(receive.getByTestId('warehouse-receive-leave')).toBeVisible();
  await receive.getByTestId('warehouse-receive-leave-stay').click();
  await expect(receive.getByTestId('warehouse-receive-leave')).toHaveCount(0);
  await expect(ssccInput).toHaveValue(sscc.slice(0, -1));
  await ssccInput.fill('');
  await scanCode(receive, `]C100${sscc}`, true);
  await expect(ssccInput).toHaveValue(sscc);
  const receiveScan = await scanCode(receive, sscc);
  await expect(receiveScan).toHaveAttribute('aria-invalid', 'true');
  await storePage.keyboard.down('Enter');
  await storePage.keyboard.down('Enter');
  await storePage.keyboard.up('Enter');
  await expect(receive).toBeVisible();
  await expect(receiving.getByTestId('warehouse-placement')).toHaveCount(0);
  await receive.getByTestId('warehouse-receive-submit').click();
  const placement = receiving.getByTestId('warehouse-placement');
  const placementCell = placement.locator('select');
  const firstCell = placementCell.locator('option').nth(1);
  const cellCode = await firstCell.innerText();
  const placementCellId = await firstCell.getAttribute('value');
  if (placementCellId === null) {
    throw new Error('Missing placement cell ID');
  }
  await scanCode(placement, cellCode, true);
  await expect(placementCell).toHaveValue(placementCellId);
  await placement.getByTestId('warehouse-place-unit').click();
  await expect(placement).toHaveCount(0);
  await receiving.getByTestId('warehouse-enter-sscc').click();
  const repeated = await scanCode(receive, sscc, true);
  await expect(repeated).toHaveAttribute('aria-invalid', 'true');
  await receive.locator('button[type="button"]').last().click();
  await receiving.getByTestId('warehouse-finish-receiving').click();

  await customer.expectStatus(DealStatus.ACCEPTING);
  await page.getByTestId('deal-receipt-confirm').click();
  await customer.expectStatus(DealStatus.ACCEPTED, DealStatus.SETTLEMENT);
  await customerFolder.expectPayment(SafeDealPaymentStatus.TO_PAYOUT);
  await advanceClock(5 * MINUTE_MS);
  await customer.expectStatus(DealStatus.CLOSED);
  await customerFolder.expectPayment(SafeDealPaymentStatus.CLOSED);

  await workspace.locator('button[id$="-trigger-movements"]').click();
  const journal = workspace.getByTestId('warehouse-movements');
  const journalUnitLinks = journal.getByRole('link', { exact: true, name: sscc });
  await expect(journalUnitLinks).toHaveCount(3);
  const unitHash = await journalUnitLinks.first().getAttribute('href');
  expect(unitHash).toMatch(/^#\/handling-units\/[\da-f-]{36}$/u);
  await expect(journal.locator(`a[href="#/cells/${placementCellId}"]`).first()).toBeVisible();
  await workspace.locator('button[id$="-trigger-stock"]').click();
  const stock = workspace.getByTestId('warehouse-stock');
  const stockUnit = stock.getByRole('link', { exact: true, name: sscc });
  await stockUnit.click();
  await expect.poll(() => new URL(storePage.url()).hash).toBe(unitHash);
  await expect(stockUnit).toBeVisible();
  await expect(stock.locator(`a[href="#/cells/${placementCellId}"]`)).toBeVisible();
  await expect(storePage.locator('canvas')).toHaveCount(0);
  await storekeeper.selectPersona(PERSONAS.constructionCustomer);
  await expect(storePage.getByTestId('warehouse-object-unavailable')).toBeVisible();
  await expect(storePage.getByText(sscc, { exact: true })).toHaveCount(0);
});
