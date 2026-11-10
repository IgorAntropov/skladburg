import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import {
  VehicleBodyType,
  VehicleCargoKind,
} from '@skladburg/contracts/fleet/v1/fleet';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { SafeDealPaymentStatus } from '@skladburg/contracts/payment/v1/payment';

import { expectNoAxeViolations } from './fixtures/axe.ts';
import {
  FAR_NETWORK_SITE,
  PERSONAS,
} from './fixtures/demoData.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createDealFolderRobot } from './robots/deal-folder-robot.ts';
import { createDealRobot } from './robots/deal-robot.ts';
import {
  agreeExchangeDeal,
  fundExchangeTrip,
  MINUTE_MS,
  TRANSPORT_BOT_WAIT_MS,
  TRIP_ARRIVAL_ADVANCE_MS,
  TRIP_DEPARTURE_ADVANCE_MS,
} from './robots/exchange-trip-journey.ts';
import { createTransportRobot } from './robots/transport-robot.ts';

const COLD_TRIP_TARIFF = /75\s000\s*₽/u;
const COLD_TRIP_PAYOUT = /73\s875\s*₽/u;
const CONSTRUCTION_TRIP_TARIFF = /38\s500\s*₽/u;
const CONSTRUCTION_LONG_VEHICLE_ID = 'e1000004-0000-4000-8000-000000000000';
const CONSTRUCTION_SHORT_VEHICLE_ID = 'e1000006-0000-4000-8000-000000000000';
const CONSTRUCTION_DRIVER_ID = 'e2000004-0000-4000-8000-000000000000';
const CONSTRUCTION_EXCHANGE_DEAL = {
  carrier: PERSONAS.constructionCarrier,
  customer: PERSONAS.constructionCustomer,
  date: '2026-10-19',
  destinationWarehouseId: '80000007-0000-4000-8000-000000000000',
  listing: { id: 'd1030021-0000-4000-8000-000000000000', name: 'Балка двутавровая 20Б1' },
  originWarehouseId: FAR_NETWORK_SITE.id,
  quantity: '2',
  supplier: PERSONAS.constructionSupplier,
} as const;

test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: DESKTOP_VIEWPORT });
test.describe.configure({ timeout: 60_000 });

test('settles an apple delivery with an automatic cold carrier offer across the three parties', async ({ browserName, context, page }) => {
  const { advanceClock, carrierPage, shipTrip, supplierPage, tripAddress } = await fundExchangeTrip({
    automaticOfferAmount: COLD_TRIP_TARIFF,
    context,
    kind: VehicleCargoKind.TEMPERATURE_CONTROLLED,
    page,
    shipperSide: 'customer',
  });
  const customer = createDealRobot(page);
  const customerFolder = createDealFolderRobot(page);
  const customerTransport = createTransportRobot(page);
  const supplierTransport = createTransportRobot(supplierPage);
  const carrierTransport = createTransportRobot(carrierPage);

  await shipTrip();
  expect(await customerTransport.openDealTrip()).toBe(tripAddress);
  expect(await supplierTransport.openDealTrip()).toBe(tripAddress);
  await advanceClock(TRIP_DEPARTURE_ADVANCE_MS);
  for (const transport of [customerTransport, supplierTransport, carrierTransport]) {
    await transport.expectTripStatus(TripStatus.IN_TRANSIT);
    await transport.expectTemperature(true);
  }
  await customerTransport.expectNoCarrierPayment();
  await supplierTransport.expectNoCarrierPayment();
  if (browserName === 'chromium') {
    await expectNoAxeViolations(carrierPage);
  }

  await advanceClock(TRIP_ARRIVAL_ADVANCE_MS);
  await carrierTransport.expectTripStatus(TripStatus.ARRIVED);
  await supplierTransport.expectTripStatus(TripStatus.ARRIVED);
  await page.goBack();
  await customer.expectStatus(DealStatus.ARRIVED);
  await customerFolder.accept();
  await customerFolder.expectPayment(SafeDealPaymentStatus.TO_PAYOUT);
  await advanceClock(3 * MINUTE_MS);
  await customer.expectStatus(DealStatus.CLOSED);
  await customerFolder.expectPayment(SafeDealPaymentStatus.CLOSED);
  await supplierTransport.expectTripStatus(TripStatus.CLOSED);
  await carrierTransport.expectTripStatus(TripStatus.CLOSED);
  await carrierTransport.expectCarrierPayout(COLD_TRIP_PAYOUT);
});

test('books the automatic offer for a 12 m beam and assigns the compatible long vehicle', async ({ browserName, context, page }) => {
  const { advanceClock, carrierPage } = await agreeExchangeDeal({ context, page, scenario: CONSTRUCTION_EXCHANGE_DEAL });
  const customerTransport = createTransportRobot(page);
  const carrierTransport = createTransportRobot(carrierPage);
  const date = CONSTRUCTION_EXCHANGE_DEAL.date;

  const requestAddress = await customerTransport.publishRequest(VehicleCargoKind.GENERAL, {
    bodyTypes: [VehicleBodyType.LONG_HAUL, VehicleBodyType.FLATBED],
    date,
    deliveryEndTime: '10:20',
    deliveryStartTime: '09:50',
    height: '350',
    length: '12000',
    palletPlaces: '0',
    volume: '2100000',
    weight: '2010000',
    width: '500',
  });
  await carrierTransport.openListedRequest(requestAddress);
  await expect(carrierPage.getByTestId('transport-request-inspector')).toContainText(/12\s000\s*×\s*500\s*×\s*350\s*мм/u);
  await advanceClock(TRANSPORT_BOT_WAIT_MS);
  await customerTransport.expectOfferAmount(CONSTRUCTION_TRIP_TARIFF);
  await customerTransport.selectOffer();
  await carrierTransport.openSelectedTrip();
  await carrierTransport.confirmOrder();
  await carrierTransport.expectTripStatus(TripStatus.CONFIRMED);

  await carrierTransport.openAssignment();
  await carrierTransport.submitAssignment(CONSTRUCTION_SHORT_VEHICLE_ID, CONSTRUCTION_DRIVER_ID, date);
  await carrierTransport.expectAssignmentRejected();
  await carrierTransport.expectTripStatus(TripStatus.CONFIRMED);
  await carrierTransport.submitAssignment(CONSTRUCTION_LONG_VEHICLE_ID, CONSTRUCTION_DRIVER_ID, date);
  await carrierTransport.expectTripStatus(TripStatus.ASSIGNED);
  await carrierTransport.expectRegistrationNumber('А004АА 000');
  if (browserName === 'chromium') {
    await expectNoAxeViolations(carrierPage);
  }
});
