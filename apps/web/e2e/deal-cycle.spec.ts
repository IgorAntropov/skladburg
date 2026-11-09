import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';

import {
  FOREIGN_NETWORK_SITE,
  GOLDEN_APPLES,
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { freezeEngineClock } from './fixtures/engineClock.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import {
  toObjectHash,
  toSectionHash,
} from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import {
  createCatalogRobot,
  toListingRoute,
} from './robots/catalog-robot.ts';
import { createDealFolderRobot } from './robots/deal-folder-robot.ts';
import { createDealRobot } from './robots/deal-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const ACCEPTANCE_DEADLINE = '2026-10-13T20:59:59.999Z';
const CANCELLATION_REASON = 'Нужно уточнить заказ';
const COMMISSION = '640,80\u00a0₽';
const DOCUMENTS = [DocumentType.SUPPLY_CONTRACT, DocumentType.SPECIFICATION, DocumentType.INVOICE] as const;
const MINUTE_MS = 60_000;
const PICKUP_DATE = '2026-10-12';
const SUPPLIER_PAYOUT = '42\u00a0079,20\u00a0₽';

test.use({
  colorScheme: 'light',
  reducedMotion: 'reduce',
  viewport: DESKTOP_VIEWPORT,
});

test('signs documents and settles a pickup deal across two tabs', async ({ browserName, context, page }) => {
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  const supplierPage = await context.newPage();
  const customer = createDealRobot(page);
  const supplier = createDealRobot(supplierPage);
  const customerFolder = createDealFolderRobot(page);
  const supplierFolder = createDealFolderRobot(supplierPage);
  const customerPersona = createPersonaRobot(page);
  const supplierPersona = createPersonaRobot(supplierPage);

  await customerPersona.openAsPersona(toObjectHash(toListingRoute(GOLDEN_APPLES.id)), PERSONAS.freshCustomer.id);
  await customerPersona.expectCurrentPersona(PERSONAS.freshCustomer);
  await createCatalogRobot(page).expectInspectorOpen(GOLDEN_APPLES.name);
  await supplierPersona.openAsPersona(toSectionHash('deals'), PERSONAS.freshSupplier.id);
  await supplierPersona.expectCurrentPersona(PERSONAS.freshSupplier);
  const advanceClock = await freezeEngineClock(page, supplierPage);

  const address = await customer.createDraft(OWN_NETWORK_SITES[0].id, '480', PICKUP_DATE);
  await customer.expectStatus(DealStatus.DRAFT);
  await customer.submitDraft();
  await supplier.openReceivedNotification(address);
  await supplier.expectStatus(DealStatus.SUBMITTED);
  await supplier.confirm(FOREIGN_NETWORK_SITE.id);
  await customer.expectStatus(DealStatus.AGREED);
  await customer.choosePickup();
  await supplier.expectStatus(DealStatus.LOGISTICS_CHOSEN);

  for (const type of DOCUMENTS) {
    await supplierFolder.expectDocument(type, DocumentStatus.DRAFT, undefined);
    await customerFolder.expectDocument(type, DocumentStatus.DRAFT, undefined);
    await supplierFolder.openDocument(type);
    if (browserName === 'chromium' && type === DocumentType.SUPPLY_CONTRACT) {
      await supplierFolder.expectNoAxeViolationsOnDocument();
    }
    await supplierFolder.signDocument();
    await customerFolder.expectDocument(type, DocumentStatus.APPROVED, 1);
    await supplierFolder.expectSignatureCount(1);
    await supplierFolder.closeDocument();
    await customerFolder.openDocument(type);
    await customerFolder.expectSignatureCount(1);
    await customerFolder.signDocument();
    await supplierFolder.expectDocument(type, DocumentStatus.SIGNED, 1);
    await customerFolder.expectSignatureCount(2);
    await customerFolder.closeDocument();
    await customerFolder.expectDocument(type, DocumentStatus.SIGNED, 1);
  }

  await customerFolder.openInvoiceFromSearch();
  await customerFolder.expectSignatureCount(2);
  await customerFolder.closeDocument();
  await customer.startCancellation(CANCELLATION_REASON);
  await customerFolder.openInvoiceFromSearch();
  await customer.expectCancellationReason(CANCELLATION_REASON);
  await customerFolder.closeDocument();
  await customer.discardCancellation();
  await customer.expectStatus(DealStatus.AWAITING_PAYMENT);
  await customerFolder.expectPayment(SafeDealPaymentStatus.INVOICED);
  await customerFolder.expectCommission(COMMISSION);
  if (browserName === 'chromium') {
    await customer.expectNoViolationsOfAccessibility();
  }
  await customerFolder.fund();
  await customerFolder.expectPayment(SafeDealPaymentStatus.AWAITING_FUNDS);
  await supplierFolder.expectPayment(SafeDealPaymentStatus.AWAITING_FUNDS);

  await advanceClock(5 * MINUTE_MS);
  await supplierFolder.expectPayment(SafeDealPaymentStatus.BLOCKED);
  await customerFolder.expectPayment(SafeDealPaymentStatus.BLOCKED);
  await supplier.expectStatus(DealStatus.PAID);
  await supplierFolder.markShipped();
  await customer.expectStatus(DealStatus.SHIPPED);
  await customerFolder.expectPayment(SafeDealPaymentStatus.HELD);

  await advanceClock(MINUTE_MS);
  await customer.expectStatus(DealStatus.ARRIVED);
  await supplier.expectStatus(DealStatus.ARRIVED);
  await customerFolder.expectAcceptanceDue(ACCEPTANCE_DEADLINE, '23:59');
  await customerFolder.accept();
  await supplierFolder.expectPayment(SafeDealPaymentStatus.TO_PAYOUT);
  await supplierFolder.expectPayout(SUPPLIER_PAYOUT);

  await advanceClock(3 * MINUTE_MS);
  await supplier.expectStatus(DealStatus.CLOSED);
  await customer.expectStatus(DealStatus.CLOSED);
  await supplierFolder.expectPayment(SafeDealPaymentStatus.CLOSED);
  await customerFolder.expectPayment(SafeDealPaymentStatus.CLOSED);
  await supplierFolder.expectPayout(SUPPLIER_PAYOUT);
  await customerFolder.expectCommission(COMMISSION);
});
