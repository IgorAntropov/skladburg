import type {
  Locator,
  Page,
} from '@playwright/test';
import type { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';

import { expect } from '@playwright/test';
import {
  VehicleBodyType,
  VehicleCargoKind,
} from '@skladburg/contracts/fleet/v1/fleet';

export const TRANSPORT_DATE = '2026-10-13';

const VEHICLE_ID = 'e1000001-0000-4000-8000-000000000000';
const DRIVER_ID = 'e2000001-0000-4000-8000-000000000000';
const TEMPERATURE_AMOUNT = /-?\d+(?:[,.]\d+)?\s*°C/u;

interface TransportRobotValue {
  assignTrip: () => Promise<void>;
  confirmOrder: () => Promise<void>;
  expectCarrierPayout: () => Promise<void>;
  expectNoCarrierPayment: () => Promise<void>;
  expectTemperature: (hasTemperature: boolean) => Promise<void>;
  expectTripStatus: (status: TripStatus) => Promise<void>;
  expectTripUnavailable: () => Promise<void>;
  openDealTrip: () => Promise<string>;
  openListedRequest: (address: string) => Promise<void>;
  openSelectedTrip: () => Promise<string>;
  publishRequest: (cargoKind: VehicleCargoKind) => Promise<string>;
  selectOffer: () => Promise<void>;
  submitOffer: () => Promise<void>;
}

const followObjectLink = async (link: Locator, objectSegment: string): Promise<string> => {
  const pattern = new RegExp(`^#/${objectSegment}/[\\da-f-]{36}$`, 'u');
  await expect(link).toHaveAttribute('href', pattern);
  const address = await link.getAttribute('href');
  if (address === null) {
    throw new Error(`Expected a link to ${objectSegment}`);
  }

  await link.click();
  return address;
};

export const createTransportRobot = (page: Page): TransportRobotValue => {
  const requestInspector = page.getByTestId('transport-request-inspector');
  const tripInspector = page.getByTestId('transport-trip-inspector');
  const tripPayment = tripInspector.getByTestId('transport-trip-payment');
  const getInput = (id: string): Locator => page.getByTestId(id).locator('input');
  const getSelect = (id: string): Locator => page.getByTestId(id).locator('select');

  return {
    async assignTrip(): Promise<void> {
      await tripInspector.getByTestId('transport-trip-assign-open').click();
      await getSelect('transport-trip-vehicle').selectOption(VEHICLE_ID);
      await getSelect('transport-trip-driver').selectOption(DRIVER_ID);
      await getInput('transport-trip-departure-date').fill(TRANSPORT_DATE);
      await getInput('transport-trip-departure-time').fill('07:15');
      await page.getByTestId('transport-trip-assign-submit').click();
    },
    async confirmOrder(): Promise<void> {
      await tripInspector.getByTestId('transport-order-confirm').click();
    },
    async expectCarrierPayout(): Promise<void> {
      await expect(tripPayment).toContainText(/985\s*₽/u);
    },
    async expectNoCarrierPayment(): Promise<void> {
      await expect(tripPayment).toHaveCount(0);
    },
    async expectTemperature(hasTemperature): Promise<void> {
      const temperature = tripInspector.getByTestId('transport-trip-temperature');
      if (hasTemperature) {
        await expect(temperature).toBeVisible();
        await expect(temperature).toContainText(TEMPERATURE_AMOUNT);
        return;
      }

      await expect(temperature).toHaveCount(0);
    },
    async expectTripStatus(status): Promise<void> {
      await expect(tripInspector).toHaveAttribute('data-status', String(status));
    },
    async expectTripUnavailable(): Promise<void> {
      await expect(page.getByTestId('transport-trip-unavailable')).toBeVisible();
      await expect(tripInspector).toHaveCount(0);
    },
    async openDealTrip(): Promise<string> {
      return followObjectLink(page.getByTestId('deal-transport-trip-link'), 'trips');
    },
    async openListedRequest(address): Promise<void> {
      const row = page.getByTestId('transport-request-row').and(page.locator(`[href="${address}"]`));
      await row.click();
      await expect(requestInspector).toBeVisible();
    },
    async openSelectedTrip(): Promise<string> {
      return followObjectLink(requestInspector.getByTestId('transport-request-trip-link'), 'trips');
    },
    async publishRequest(cargoKind): Promise<string> {
      await page.getByTestId('deal-transport-publish-open').click();
      await getSelect('deal-transport-cargo-kind').selectOption(String(cargoKind));
      await page.getByTestId(`deal-transport-body-type-${String(VehicleBodyType.REFRIGERATED)}`).click();
      const fields = {
        'delivery-end-date': TRANSPORT_DATE,
        'delivery-end-time': '23:40',
        'delivery-start-date': TRANSPORT_DATE,
        'delivery-start-time': '23:10',
        'height': '1000',
        'length': '1200',
        'pallet-places': '1',
        'pickup-end-date': TRANSPORT_DATE,
        'pickup-end-time': '07:30',
        'pickup-start-date': TRANSPORT_DATE,
        'pickup-start-time': '07:00',
        'volume': '960000',
        'weight': '480000',
        'width': '800',
      };

      for (const [field, value] of Object.entries(fields)) {
        await getInput(`deal-transport-${field}`).fill(value);
      }
      if (cargoKind === VehicleCargoKind.TEMPERATURE_CONTROLLED) {
        await getInput('deal-transport-temperature-min').fill('2');
        await getInput('deal-transport-temperature-max').fill('4');
      }

      await page.getByTestId('deal-transport-publish-submit').click();
      return followObjectLink(page.getByTestId('deal-transport-request-link'), 'transport-requests');
    },
    async selectOffer(): Promise<void> {
      await requestInspector.getByTestId('transport-offer-select-open').click();
      await page.getByTestId('transport-offer-select-submit').click();
    },
    async submitOffer(): Promise<void> {
      await requestInspector.getByTestId('transport-offer-open').click();
      await getInput('transport-offer-amount').fill('1000');
      await page.getByTestId('transport-offer-submit').click();
    },
  };
};
