import { expect } from '@playwright/test';
import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';

import { expectNoAxeViolations } from './fixtures/axe.ts';
import { PERSONAS } from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import { toSectionHash } from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import {
  denyCameraTestFeed,
  expectCameraTestFeedStopped,
  installCameraTestFeed,
  openWarehouseCamera,
  setCameraTestVisibility,
  showCameraCode,
} from './robots/camera-scan-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { openPrintPreview } from './robots/print-labels-robot.ts';
import {
  CUSTOMER_WAREHOUSE_HASH,
  MINUTE_MS,
  prepareWarehouseDelivery,
  scanCode,
} from './robots/warehouse-delivery-robot.ts';

test.use({ reducedMotion: 'reduce', viewport: DESKTOP_VIEWPORT });

test('picks and receives a seeded delivery through the warehouse workspace without 3D', async ({ browserName, context, page }) => {
  test.setTimeout(120_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  const supplierPage = await context.newPage();
  const storePage = await context.newPage();
  await installCameraTestFeed(storePage);
  const cameraRequests = new Set<string>();
  const sceneRequests = new Set<string>();
  storePage.on('request', (request) => {
    if (/cameraDecoder\.worker|zxing_reader/u.test(request.url())) {
      cameraRequests.add(request.url());
    }
    if (/WarehouseWorldScene|SceneRoot/u.test(request.url())) {
      sceneRequests.add(request.url());
    }
  });
  await storePage.setViewportSize(PHONE_VIEWPORT);
  await storePage.emulateMedia({ colorScheme: 'dark' });
  const storekeeper = createPersonaRobot(storePage);
  const { advanceClock, customer, customerFolder, sscc } = await prepareWarehouseDelivery({
    hasPrintChecks: true,
    hasScanChecks: true,
    onWarehouseOpen: async () => {
      await expect(storePage.locator('canvas')).toHaveCount(0);
    },
    page,
    storePage,
    supplierPage,
  });
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
  await denyCameraTestFeed(storePage, true);
  const foreignScan = await scanCode(receive, 'https://example.test/skladburg/#/cells/00000000-0000-4000-8000-000000000001', true);
  await expect(foreignScan).toHaveAttribute('aria-invalid', 'true');
  const deniedCamera = await openWarehouseCamera(receive);
  await expect(deniedCamera.getByRole('alert')).toContainText('Разрешите доступ');
  expect(cameraRequests.size).toBe(0);
  await deniedCamera.getByTestId('warehouse-camera-close').click();
  await expect(receive.getByTestId('warehouse-camera-open')).toBeFocused();
  await foreignScan.focus();
  await scanCode(receive, `]C100${sscc}`);
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
  const printUnitButton = receiving.getByTestId('print-labels-open');
  const unitPrint = await openPrintPreview(printUnitButton);
  expect(await unitPrint.getStyle().textContent()).toContain('size: 100mm 150mm');
  await expect(unitPrint.getPages().locator('figcaption')).toHaveText(`(00) ${sscc}`);
  const unitCode = await unitPrint.getPages().locator('figure img').getAttribute('src');
  await unitPrint.print();
  await unitPrint.close();
  const repeatedPrint = await openPrintPreview(printUnitButton);
  if (unitCode === null) {
    throw new Error('Missing printed SSCC image');
  }
  await expect(repeatedPrint.getPages().locator('figure img')).toHaveAttribute('src', unitCode);
  await repeatedPrint.close();
  const placementCell = placement.locator('select');
  const firstCell = placementCell.locator('option').nth(1);
  const cellCode = await firstCell.innerText();
  const placementCellId = await firstCell.getAttribute('value');
  if (placementCellId === null) {
    throw new Error('Missing placement cell ID');
  }
  await scanCode(placement, cellCode, true);
  await expect(placementCell).toHaveValue(placementCellId);
  await placementCell.selectOption('');
  await denyCameraTestFeed(storePage, false);
  const camera = await openWarehouseCamera(placement);
  await expect(camera.getByRole('status')).toHaveText('Принято кодов: 0');
  expect([...cameraRequests].some(url => url.startsWith(new URL(storePage.url()).origin) && url.endsWith('.wasm'))).toBe(true);
  await showCameraCode(storePage, cellCode, 'cell');
  await expect(placementCell).toHaveValue(placementCellId);
  await expect(camera.getByRole('status')).toHaveText('Принято кодов: 1');
  await showCameraCode(storePage, 'XX-01', 'cell');
  await expect(camera.getByRole('status')).toHaveText('Проверьте код и выбранное место.');
  await setCameraTestVisibility(storePage, true);
  await expect(camera.getByTestId('warehouse-camera-restart')).toBeVisible();
  await expectCameraTestFeedStopped(storePage);
  await setCameraTestVisibility(storePage, false);
  await expectCameraTestFeedStopped(storePage);
  await camera.getByTestId('warehouse-camera-restart').click();
  await expect(camera.getByRole('status')).toHaveText('Принято кодов: 1');
  await camera.getByTestId('warehouse-camera-close').click();
  await expectCameraTestFeedStopped(storePage);
  await placement.getByTestId('warehouse-place-unit').click();
  await expect(placement).toHaveCount(0);
  await receiving.getByTestId('warehouse-enter-sscc').click();
  const repeated = await scanCode(receive, sscc, true);
  await expect(repeated).toHaveAttribute('aria-invalid', 'true');
  const scanCellUrl = new URL(`#/cells/${placementCellId}`, storePage.url()).href;
  await ssccInput.fill(sscc.slice(0, -1));
  await openWarehouseCamera(receive);
  await expect(receive.getByTestId('warehouse-camera-scanner').getByRole('status')).toHaveText('Принято кодов: 0');
  await showCameraCode(storePage, scanCellUrl, 'qr');
  await expect(receive.getByTestId('warehouse-receive-leave')).toBeVisible();
  await expectCameraTestFeedStopped(storePage);
  await receive.getByTestId('warehouse-receive-leave-stay').click();
  await expect(ssccInput).toHaveValue(sscc.slice(0, -1));
  await repeated.focus();
  await scanCode(receive, `]Q1${scanCellUrl}`);
  await receive.getByTestId('warehouse-receive-leave-leave').click();
  await expect.poll(() => new URL(storePage.url()).hash).toBe(`#/cells/${placementCellId}`);
  await storePage.goBack();
  await expect.poll(() => new URL(storePage.url()).hash).toBe(CUSTOMER_WAREHOUSE_HASH);
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
  const cellLink = stock.locator(`a[href="#/cells/${placementCellId}"]`);
  await cellLink.click();
  await workspace.locator('button[id$="-trigger-addresses"]').click();
  const cellPrint = await openPrintPreview(workspace.getByTestId('warehouse-print-cell'));
  expect(await cellPrint.getStyle().textContent()).toContain('size: 58mm 40mm');
  await expect(cellPrint.getPages()).toHaveCount(1);
  await expect(cellPrint.getPages().locator('h1')).toHaveText(cellCode);
  await cellPrint.close();
  const rackPrint = await openPrintPreview(workspace.getByTestId('warehouse-print-rack'));
  expect(await rackPrint.getStyle().textContent()).toContain('size: 58mm 40mm');
  const pageCount = await rackPrint.getPages().count();
  expect(pageCount).toBeGreaterThan(1);
  await rackPrint.print();
  await rackPrint.close();
  await storekeeper.selectPersona(PERSONAS.constructionCustomer);
  await expect(storePage.getByTestId('warehouse-object-unavailable')).toBeVisible();
  await expect(storePage.getByText(sscc, { exact: true })).toHaveCount(0);
  expect(sceneRequests.size).toBe(0);
});
