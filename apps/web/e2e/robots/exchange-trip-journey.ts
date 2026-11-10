import type {
  BrowserContext,
  Page,
} from '@playwright/test';
import type { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';

import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentStatus,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';

import type { PersonaValue } from '../fixtures/demoData.ts';

import {
  FOREIGN_NETWORK_SITE,
  GOLDEN_APPLES,
  OWN_NETWORK_SITES,
  PERSONAS,
} from '../fixtures/demoData.ts';
import { freezeEngineClock } from '../fixtures/engineClock.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from '../fixtures/graphicsPreference.ts';
import {
  toObjectHash,
  toSectionHash,
} from '../fixtures/routes.ts';
import { expect } from '../fixtures/test.ts';
import { createStoreSystemThemeScript } from '../fixtures/themePreference.ts';
import { PHONE_VIEWPORT } from '../fixtures/viewports.ts';
import {
  createCatalogRobot,
  toListingRoute,
} from './catalog-robot.ts';
import { createDealFolderRobot } from './deal-folder-robot.ts';
import { createDealRobot } from './deal-robot.ts';
import { createPersonaRobot } from './persona-robot.ts';
import {
  createTransportRobot,
  TRANSPORT_DATE,
} from './transport-robot.ts';

export const MINUTE_MS = 60_000;

export const TRANSPORT_BOT_WAIT_MS = 2 * MINUTE_MS;
export const TRIP_ARRIVAL_ADVANCE_MS = 971 * MINUTE_MS;
export const TRIP_DEPARTURE_ADVANCE_MS = 71 * MINUTE_MS;

const DOCUMENT_TYPES = [DocumentType.SUPPLY_CONTRACT, DocumentType.SPECIFICATION, DocumentType.INVOICE] as const;
const DAY_MINUTES = 24 * 60;

interface AgreedExchangeDealValue {
  advanceClock: (elapsedMs: number) => Promise<void>;
  carrierPage: Page;
  supplierPage: Page;
}

interface AgreeExchangeDealOptionsValue {
  context: BrowserContext;
  page: Page;
  scenario?: ExchangeDealScenarioValue | undefined;
}

interface ExchangeDealScenarioValue {
  carrier: PersonaValue;
  customer: PersonaValue;
  date: string;
  destinationWarehouseId: string;
  listing: { id: string; name: string };
  originWarehouseId: string;
  quantity: string;
  supplier: PersonaValue;
}

interface FundedExchangeTripValue {
  advanceClock: (elapsedMs: number) => Promise<void>;
  carrierPage: Page;
  shipTrip: () => Promise<void>;
  supplierPage: Page;
  tripAddress: string;
}

interface FundExchangeTripOptionsValue extends Pick<AgreeExchangeDealOptionsValue, 'context' | 'page'> {
  automaticOfferAmount?: RegExp | undefined;
  kind: VehicleCargoKind;
  shipperSide: 'customer' | 'supplier';
}

const APPLE_EXCHANGE_DEAL: ExchangeDealScenarioValue = {
  carrier: PERSONAS.freshCarrier,
  customer: PERSONAS.freshCustomer,
  date: TRANSPORT_DATE,
  destinationWarehouseId: OWN_NETWORK_SITES[0].id,
  listing: GOLDEN_APPLES,
  originWarehouseId: FOREIGN_NETWORK_SITE.id,
  quantity: '480',
  supplier: PERSONAS.freshSupplier,
};

export const agreeExchangeDeal = async ({
  context,
  page,
  scenario = APPLE_EXCHANGE_DEAL,
}: AgreeExchangeDealOptionsValue): Promise<AgreedExchangeDealValue> => {
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
  const customerPersona = createPersonaRobot(page);
  const supplierPersona = createPersonaRobot(supplierPage);
  const carrierPersona = createPersonaRobot(carrierPage);

  await customerPersona.openAsPersona(toObjectHash(toListingRoute(scenario.listing.id)), scenario.customer.id);
  await createCatalogRobot(page).expectInspectorOpen(scenario.listing.name);
  await supplierPersona.openAsPersona(toSectionHash('deals'), scenario.supplier.id);
  await supplierPersona.expectCurrentPersona(scenario.supplier);
  await carrierPersona.openAsPersona(toSectionHash('transport'), scenario.carrier.id);
  await expect(carrierPage.getByTestId('page-transport')).toBeVisible();
  await expect(carrierPage.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(carrierPage.locator('canvas')).toHaveCount(0);
  const advanceClock = await freezeEngineClock(page, supplierPage, carrierPage);

  const dealAddress = await customer.createDraft(scenario.destinationWarehouseId, scenario.quantity, scenario.date);
  await customer.submitDraft();
  await supplier.openReceivedNotification(dealAddress);
  await supplier.confirm(scenario.originWarehouseId);
  await customer.expectStatus(DealStatus.AGREED);

  return { advanceClock, carrierPage, supplierPage };
};

export const fundExchangeTrip = async ({
  automaticOfferAmount,
  context,
  kind,
  page,
  shipperSide,
}: FundExchangeTripOptionsValue): Promise<FundedExchangeTripValue> => {
  const { advanceClock, carrierPage, supplierPage } = await agreeExchangeDeal({ context, page });
  const customer = createDealRobot(page);
  const supplier = createDealRobot(supplierPage);
  const customerFolder = createDealFolderRobot(page);
  const supplierFolder = createDealFolderRobot(supplierPage);
  const carrierTransport = createTransportRobot(carrierPage);
  const shipperPage = shipperSide === 'customer' ? page : supplierPage;
  const shipperTransport = createTransportRobot(shipperPage);

  const requestAddress = await shipperTransport.publishRequest(kind);
  await carrierTransport.openListedRequest(requestAddress);
  const carrierRequest = carrierPage.getByTestId('transport-request-inspector');
  await expect(carrierRequest).not.toContainText(PERSONAS.freshCustomer.organizationName);
  await expect(carrierRequest).not.toContainText(PERSONAS.freshSupplier.organizationName);
  if (automaticOfferAmount === undefined) {
    await carrierTransport.submitOffer();
  }
  else {
    await advanceClock(TRANSPORT_BOT_WAIT_MS);
    await shipperTransport.expectOfferAmount(automaticOfferAmount);
  }
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

  const shipTrip = async (): Promise<void> => {
    const elapsedWaitingForOffer = automaticOfferAmount === undefined ? 0 : TRANSPORT_BOT_WAIT_MS;

    await advanceClock(DAY_MINUTES * MINUTE_MS - elapsedWaitingForOffer);
    await supplierFolder.markShipped();
    await carrierTransport.expectTripStatus(TripStatus.LOADED);
  };

  return { advanceClock, carrierPage, shipTrip, supplierPage, tripAddress };
};
