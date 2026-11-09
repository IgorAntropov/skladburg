import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { DocumentType } from '@skladburg/contracts/document/v1/document';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';

import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { freezeEngineClock } from './fixtures/engineClock.ts';
import { toObjectHash } from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import {
  createCatalogRobot,
  toListingRoute,
} from './robots/catalog-robot.ts';
import { createDealFolderRobot } from './robots/deal-folder-robot.ts';
import { createDealRobot } from './robots/deal-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const DUCK_LISTING = {
  id: 'd1060001-0000-4000-8000-000000000000',
  name: 'Утка тушка охлаждённая, 1 сорт',
} as const;
const MINUTE_MS = 60_000;
const PICKUP_DATE = '2026-10-12';

test.use({
  colorScheme: 'light',
  reducedMotion: 'reduce',
  viewport: DESKTOP_VIEWPORT,
});

test('settles a deal with an automated supplier from the customer tab', async ({ page }) => {
  const customer = createDealRobot(page);
  const folder = createDealFolderRobot(page);
  const persona = createPersonaRobot(page);

  await persona.openAsPersona(toObjectHash(toListingRoute(DUCK_LISTING.id)), PERSONAS.freshCustomer.id);
  await persona.expectCurrentPersona(PERSONAS.freshCustomer);
  await createCatalogRobot(page).expectInspectorOpen(DUCK_LISTING.name);
  const advanceClock = await freezeEngineClock(page);

  await customer.createDraft(OWN_NETWORK_SITES[0].id, '200', PICKUP_DATE);
  await customer.expectStatus(DealStatus.DRAFT);
  await customer.submitDraft();
  await customer.expectStatus(DealStatus.SUBMITTED);
  await advanceClock(2 * MINUTE_MS);
  await customer.expectStatus(DealStatus.AGREED);

  await customer.choosePickup();
  await customer.expectStatus(DealStatus.LOGISTICS_CHOSEN);
  await advanceClock(2 * MINUTE_MS);

  await folder.openDocument(DocumentType.SUPPLY_CONTRACT);
  await folder.expectSignatureCount(2);
  await folder.closeDocument();

  for (const type of [DocumentType.SPECIFICATION, DocumentType.INVOICE]) {
    await folder.openDocument(type);
    await folder.expectSignatureCount(1);
    await folder.signDocument();
    await folder.expectSignatureCount(2);
    await folder.closeDocument();
  }

  await customer.expectStatus(DealStatus.AWAITING_PAYMENT);
  await folder.expectPayment(SafeDealPaymentStatus.INVOICED);
  await folder.fund();
  await folder.expectPayment(SafeDealPaymentStatus.AWAITING_FUNDS);
  await advanceClock(5 * MINUTE_MS);
  await customer.expectStatus(DealStatus.IN_TRANSIT);
  await folder.expectPayment(SafeDealPaymentStatus.HELD);
  await advanceClock(MINUTE_MS);
  await customer.expectStatus(DealStatus.ARRIVED);
  await folder.accept();
  await folder.expectPayment(SafeDealPaymentStatus.TO_PAYOUT);
  await advanceClock(3 * MINUTE_MS);
  await customer.expectStatus(DealStatus.CLOSED);
  await folder.expectPayment(SafeDealPaymentStatus.CLOSED);
});
