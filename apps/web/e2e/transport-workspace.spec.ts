import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';

import { expectNoAxeViolations } from './fixtures/axe.ts';
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
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import {
  createCatalogRobot,
  toListingRoute,
} from './robots/catalog-robot.ts';
import { createDealFolderRobot } from './robots/deal-folder-robot.ts';
import { createDealRobot } from './robots/deal-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import {
  createTransportRobot,
  TRANSPORT_DATE,
} from './robots/transport-robot.ts';

const DOCUMENT_TYPES = [DocumentType.SUPPLY_CONTRACT, DocumentType.SPECIFICATION, DocumentType.INVOICE] as const;
const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;

const CARGO_SCENARIOS = [
  { kind: VehicleCargoKind.TEMPERATURE_CONTROLLED, shipperSide: 'customer', title: 'temperature-controlled cargo' },
  { kind: VehicleCargoKind.GENERAL, shipperSide: 'supplier', title: 'general cargo' },
] as const;

test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: DESKTOP_VIEWPORT });
test.describe.configure({ timeout: 60_000 });

for (const { kind, shipperSide, title } of CARGO_SCENARIOS) {
  test(`books and settles an exchange trip across the three workspaces for ${title}`, async ({ browserName, context, page }) => {
    const supplierPage = await context.newPage();
    const carrierPage = await context.newPage();
    const graphicsPreference = createStoreGraphicsPreferenceIfAbsentScript('off');
    await supplierPage.addInitScript({ content: graphicsPreference });
    await carrierPage.addInitScript({ content: graphicsPreference });
    await carrierPage.addInitScript({ content: createStoreSystemThemeScript() });
    await carrierPage.setViewportSize(PHONE_VIEWPORT);
    await carrierPage.emulateMedia({ colorScheme: 'dark' });
    const customer = createDealRobot(page);
    const supplier = createDealRobot(supplierPage);
    const customerFolder = createDealFolderRobot(page);
    const supplierFolder = createDealFolderRobot(supplierPage);
    const customerPersona = createPersonaRobot(page);
    const supplierPersona = createPersonaRobot(supplierPage);
    const carrierPersona = createPersonaRobot(carrierPage);
    const customerTransport = createTransportRobot(page);
    const supplierTransport = createTransportRobot(supplierPage);
    const carrierTransport = createTransportRobot(carrierPage);
    const shipperPage = shipperSide === 'customer' ? page : supplierPage;
    const shipperTransport = shipperSide === 'customer' ? customerTransport : supplierTransport;
    const recipientTransport = shipperSide === 'customer' ? supplierTransport : customerTransport;

    await customerPersona.openAsPersona(toObjectHash(toListingRoute(GOLDEN_APPLES.id)), PERSONAS.freshCustomer.id);
    await createCatalogRobot(page).expectInspectorOpen(GOLDEN_APPLES.name);
    await supplierPersona.openAsPersona(toSectionHash('deals'), PERSONAS.freshSupplier.id);
    await supplierPersona.expectCurrentPersona(PERSONAS.freshSupplier);
    await carrierPersona.openAsPersona(toSectionHash('transport'), PERSONAS.freshCarrier.id);
    await expect(carrierPage.getByTestId('page-transport')).toBeVisible();
    await expect(carrierPage.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(carrierPage.locator('canvas')).toHaveCount(0);
    const advanceClock = await freezeEngineClock(page, supplierPage, carrierPage);

    const dealAddress = await customer.createDraft(OWN_NETWORK_SITES[0].id, '480', TRANSPORT_DATE);
    await customer.submitDraft();
    await supplier.openReceivedNotification(dealAddress);
    await supplier.confirm(FOREIGN_NETWORK_SITE.id);
    await customer.expectStatus(DealStatus.AGREED);

    const requestAddress = await shipperTransport.publishRequest(kind);
    await carrierTransport.openListedRequest(requestAddress);
    const carrierRequest = carrierPage.getByTestId('transport-request-inspector');
    await expect(carrierRequest).not.toContainText(PERSONAS.freshCustomer.organizationName);
    await expect(carrierRequest).not.toContainText(PERSONAS.freshSupplier.organizationName);
    await carrierTransport.submitOffer();
    await shipperTransport.selectOffer();
    const tripAddress = await carrierTransport.openSelectedTrip();
    await carrierTransport.expectTripStatus(TripStatus.AWAITING_CONFIRMATION);
    await carrierTransport.confirmOrder();
    await carrierTransport.assignTrip();
    await carrierTransport.expectTripStatus(TripStatus.ASSIGNED);
    await carrierTransport.expectTemperature(false);

    await shipperPage.goBack();
    await customer.expectStatus(DealStatus.LOGISTICS_CHOSEN);
    for (const type of DOCUMENT_TYPES) {
      await supplierFolder.openDocument(type);
      await supplierFolder.signDocument();
      await customerFolder.expectDocument(type, DocumentStatus.APPROVED, 1);
      await supplierFolder.closeDocument();
      await customerFolder.openDocument(type);
      await customerFolder.signDocument();
      await supplierFolder.expectDocument(type, DocumentStatus.SIGNED, 1);
      await customerFolder.closeDocument();
    }

    await customerFolder.expectPayment(SafeDealPaymentStatus.INVOICED);
    await customerFolder.fund();
    await customerFolder.expectPayment(SafeDealPaymentStatus.AWAITING_FUNDS);
    await advanceClock(5 * MINUTE_MS);
    await supplier.expectStatus(DealStatus.PAID);
    await advanceClock(DAY_MINUTES * MINUTE_MS);
    await supplierFolder.markShipped();
    await carrierTransport.expectTripStatus(TripStatus.LOADED);

    expect(await supplierTransport.openDealTrip()).toBe(tripAddress);
    expect(await customerTransport.openDealTrip()).toBe(tripAddress);
    await advanceClock(71 * MINUTE_MS);
    const hasTemperature = kind === VehicleCargoKind.TEMPERATURE_CONTROLLED;
    for (const transport of [carrierTransport, supplierTransport, customerTransport]) {
      await transport.expectTripStatus(TripStatus.IN_TRANSIT);
      await transport.expectTemperature(hasTemperature);
    }
    if (browserName === 'chromium') {
      await expectNoAxeViolations(carrierPage);
    }
    await recipientTransport.expectNoCarrierPayment();

    await advanceClock(971 * MINUTE_MS);
    await carrierTransport.expectTripStatus(TripStatus.ARRIVED);
    await page.goBack();
    await customer.expectStatus(DealStatus.ARRIVED);
    await customerFolder.accept();
    await customerFolder.expectPayment(SafeDealPaymentStatus.TO_PAYOUT);
    await advanceClock(3 * MINUTE_MS);
    await customer.expectStatus(DealStatus.CLOSED);
    await customerFolder.expectPayment(SafeDealPaymentStatus.CLOSED);
    await carrierTransport.expectTripStatus(TripStatus.CLOSED);
    await carrierTransport.expectCarrierPayout();

    await carrierPersona.selectPersona(PERSONAS.constructionCarrier);
    await carrierTransport.expectTripUnavailable();
  });
}
