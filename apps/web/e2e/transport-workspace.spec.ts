import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';

import { expectNoAxeViolations } from './fixtures/axe.ts';
import { PERSONAS } from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import { toSectionHash } from './fixtures/routes.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createDealFolderRobot } from './robots/deal-folder-robot.ts';
import { createDealRobot } from './robots/deal-robot.ts';
import {
  fundExchangeTrip,
  MINUTE_MS,
  TRIP_ARRIVAL_ADVANCE_MS,
  TRIP_DEPARTURE_ADVANCE_MS,
} from './robots/exchange-trip-journey.ts';
import { createNetworkTripsRobot } from './robots/network-trips-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import {
  createTransportRobot,
  TRANSPORT_REGISTRATION_NUMBER,
} from './robots/transport-robot.ts';

const CARGO_SCENARIOS = [
  { kind: VehicleCargoKind.TEMPERATURE_CONTROLLED, shipperSide: 'customer', title: 'temperature-controlled cargo' },
  { kind: VehicleCargoKind.GENERAL, shipperSide: 'supplier', title: 'general cargo' },
] as const;

test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: DESKTOP_VIEWPORT });
test.describe.configure({ timeout: 60_000 });

for (const { kind, shipperSide, title } of CARGO_SCENARIOS) {
  test(`books and settles an exchange trip across the three workspaces for ${title}`, async ({ browserName, context, page }) => {
    const { advanceClock, carrierPage, shipTrip, supplierPage, tripAddress } = await fundExchangeTrip({ context, kind, page, shipperSide });
    const customer = createDealRobot(page);
    const customerFolder = createDealFolderRobot(page);
    const carrierPersona = createPersonaRobot(carrierPage);
    const customerTransport = createTransportRobot(page);
    const supplierTransport = createTransportRobot(supplierPage);
    const carrierTransport = createTransportRobot(carrierPage);
    const recipientTransport = shipperSide === 'customer' ? supplierTransport : customerTransport;

    await shipTrip();
    expect(await supplierTransport.openDealTrip()).toBe(tripAddress);
    expect(await customerTransport.openDealTrip()).toBe(tripAddress);
    await advanceClock(TRIP_DEPARTURE_ADVANCE_MS);
    const hasTemperature = kind === VehicleCargoKind.TEMPERATURE_CONTROLLED;
    for (const transport of [carrierTransport, supplierTransport, customerTransport]) {
      await transport.expectTripStatus(TripStatus.IN_TRANSIT);
      await transport.expectTemperature(hasTemperature);
    }
    if (browserName === 'chromium') {
      await expectNoAxeViolations(carrierPage);
    }
    await recipientTransport.expectNoCarrierPayment();

    const networkTrips = createNetworkTripsRobot(supplierPage);
    await networkTrips.openFromApp();
    await networkTrips.expectStatus(tripAddress, TripStatus.IN_TRANSIT);
    await networkTrips.expectVehicle(tripAddress, PERSONAS.freshCarrier.organizationName, TRANSPORT_REGISTRATION_NUMBER);
    await expect(supplierPage.getByTestId('scene-viewport')).toHaveAttribute('data-scene-state', 'off');
    await expect(supplierPage.locator('canvas')).toHaveCount(0);
    await networkTrips.openTrip(tripAddress);
    await supplierTransport.expectTripStatus(TripStatus.IN_TRANSIT);

    const outsiderPage = await context.newPage();
    await outsiderPage.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
    await createPersonaRobot(outsiderPage).openAsPersona(toSectionHash('network'), PERSONAS.constructionCarrier.id);
    await createNetworkTripsRobot(outsiderPage).expectNoTrips();
    await outsiderPage.close();

    await advanceClock(TRIP_ARRIVAL_ADVANCE_MS);
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

    await networkTrips.openFromApp();
    await networkTrips.expectNoTrips();

    await carrierPersona.selectPersona(PERSONAS.constructionCarrier);
    await carrierTransport.expectTripUnavailable();
  });
}
