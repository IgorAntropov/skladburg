import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { DocumentType } from '@skladburg/contracts/document/v1/document';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';

import {
  GOLDEN_APPLES,
  OWN_NETWORK_SITES,
  PERSONAS,
} from '../fixtures/demoData.ts';
import { freezeEngineClock } from '../fixtures/engineClock.ts';
import {
  toObjectHash,
  toSectionHash,
  toWarehouseRoute,
} from '../fixtures/routes.ts';
import { toListingRoute } from './catalog-robot.ts';
import { createDealFolderRobot } from './deal-folder-robot.ts';
import { createDealRobot } from './deal-robot.ts';
import { createPersonaRobot } from './persona-robot.ts';
import { openPrintPreview } from './print-labels-robot.ts';

const SUPPLIER_WAREHOUSE_ID = '80000011-0000-4000-8000-000000000000';
export const MINUTE_MS = 60_000;
const ORDER_DATE = '2026-10-12';
export const CUSTOMER_WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(OWN_NETWORK_SITES[0].id));
const SUPPLIER_WAREHOUSE_HASH = toObjectHash(toWarehouseRoute(SUPPLIER_WAREHOUSE_ID));

export const scanCode = async (surface: Locator, code: string, isOpening = false): Promise<Locator> => {
  if (isOpening) {
    await surface.getByTestId('warehouse-open-scanner').click();
  }
  const input = surface.getByTestId('warehouse-scan-input').locator('input');
  await expect(input).toBeFocused();
  await input.pressSequentially(code);
  await input.press('Enter');

  return input;
};

interface WarehouseDeliveryOptionsValue {
  hasPrintChecks?: boolean | undefined;
  hasScanChecks?: boolean | undefined;
  onBeforeArrival?: (() => Promise<void>) | undefined;
  onWarehouseOpen?: (() => Promise<void>) | undefined;
  page: Page;
  storePage: Page;
  supplierPage: Page;
}

interface WarehouseDeliveryValue {
  advanceClock: Awaited<ReturnType<typeof freezeEngineClock>>;
  customer: ReturnType<typeof createDealRobot>;
  customerFolder: ReturnType<typeof createDealFolderRobot>;
  sscc: string;
}

export const prepareWarehouseDelivery = async ({
  hasPrintChecks, hasScanChecks, onBeforeArrival, onWarehouseOpen, page, storePage, supplierPage,
}: WarehouseDeliveryOptionsValue): Promise<WarehouseDeliveryValue> => {
  const customer = createDealRobot(page);
  const supplier = createDealRobot(supplierPage);
  const customerFolder = createDealFolderRobot(page);
  const supplierFolder = createDealFolderRobot(supplierPage);

  await createPersonaRobot(page).openAsPersona(toObjectHash(toListingRoute(GOLDEN_APPLES.id)), PERSONAS.freshCustomer.id);
  await createPersonaRobot(supplierPage).openAsPersona(toSectionHash('deals'), PERSONAS.freshSupplier.id);
  await createPersonaRobot(storePage).openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshStorekeeper.id);
  await expect(page.getByTestId('order-open')).toBeVisible();
  await expect(supplierPage.getByTestId('deals-board')).toBeVisible();
  await expect(storePage.getByTestId('warehouse-workspace')).toBeVisible();
  await onWarehouseOpen?.();
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

  if (hasPrintChecks) {
    await customerFolder.openDocument(DocumentType.INVOICE);
    const documentPrint = await openPrintPreview(page.getByTestId('deal-document-view').getByTestId('print-labels-open'));
    await expect(documentPrint.getPages()).toHaveCount(1);
    await expect(documentPrint.getPages().locator('img')).toHaveCount(1);
    await documentPrint.close(true);
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
  if (hasPrintChecks) {
    const pickingPrint = await openPrintPreview(picking.getByTestId('warehouse-print-picking'));
    await expect(pickingPrint.getPages().locator('h1')).toHaveText('Лист подбора');
    await expect(pickingPrint.getPages().locator('img')).toHaveCount(1);
    await pickingPrint.close();
  }
  await picking.getByTestId('warehouse-claim-picking').click();
  const unit = picking.getByTestId('warehouse-pick-unit');
  await expect(unit).toHaveCount(1);
  const sscc = await picking.getByText(/^\d{18}$/u).innerText();
  await expect(picking.getByTestId('warehouse-confirm-picking')).toBeDisabled();
  if (hasScanChecks) {
    const pickInput = await scanCode(picking, ']C100000000000000000024', true);
    await expect(pickInput).toHaveAttribute('aria-invalid', 'true');
    await expect(unit).toHaveAttribute('aria-pressed', 'false');
    await scanCode(picking, `]C100${sscc}`);
    await expect(unit).toHaveAttribute('aria-pressed', 'true');
    await scanCode(picking, sscc);
    await expect(pickInput).toHaveAttribute('aria-invalid', 'true');
    await expect(unit).toHaveAttribute('aria-pressed', 'true');
  }
  else {
    await scanCode(picking, `]C100${sscc}`, true);
  }
  await picking.getByTestId('warehouse-confirm-picking').click();
  await picking.getByTestId('warehouse-confirm-shipment').click();

  await customer.expectStatus(DealStatus.SHIPPED, DealStatus.IN_TRANSIT);
  await onBeforeArrival?.();
  await advanceClock(2 * MINUTE_MS);
  await customer.expectStatus(DealStatus.ARRIVED);
  await expect(page.getByTestId('deal-accept')).toHaveCount(0);
  return { advanceClock, customer, customerFolder, sscc };
};
