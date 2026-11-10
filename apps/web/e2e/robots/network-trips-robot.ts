import type {
  Locator,
  Page,
} from '@playwright/test';
import type { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';

import { expect } from '@playwright/test';

import { createNavigationRobot } from './navigation-robot.ts';
import { createNetworkRobot } from './network-robot.ts';

interface NetworkTripsRobotValue {
  expectNoTrips: () => Promise<void>;
  expectStatus: (tripAddress: string, status: TripStatus) => Promise<void>;
  expectVehicle: (tripAddress: string, carrierName: string, registrationNumber: string) => Promise<void>;
  openFromApp: () => Promise<void>;
  openTrip: (tripAddress: string) => Promise<void>;
}

export const createNetworkTripsRobot = (page: Page): NetworkTripsRobotValue => {
  const navigation = createNavigationRobot(page);
  const networkRobot = createNetworkRobot(page);
  const network = page.getByTestId('page-network');
  const rows = network.getByTestId('network-trip-row');
  const getRow = (tripAddress: string): Locator => rows.and(network.locator(`[href="${tripAddress}"]`));

  return {
    async expectNoTrips(): Promise<void> {
      await networkRobot.openListTab('trips');
      await expect(network.getByTestId('network-trip-empty')).toBeVisible();
      await expect(rows).toHaveCount(0);
    },
    async expectStatus(tripAddress, status): Promise<void> {
      await expect(getRow(tripAddress)).toHaveAttribute('data-status', String(status));
    },
    async expectVehicle(tripAddress, carrierName, registrationNumber): Promise<void> {
      const row = getRow(tripAddress);

      await expect(row).toContainText(carrierName);
      await expect(row).toContainText(registrationNumber);
    },
    async openFromApp(): Promise<void> {
      await navigation.clickSection('network');
      await navigation.expectSection('network');
      await networkRobot.openListTab('trips');
    },
    async openTrip(tripAddress): Promise<void> {
      await getRow(tripAddress).click();
      await navigation.expectAddress(tripAddress);
    },
  };
};
