import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import {
  ORGANIZATION_NAME,
  WAREHOUSE_NAMES,
} from '../fixtures/demoData.ts';

export interface WarehouseRobotValue {
  expectEngineData: () => Promise<void>;
}

export const createWarehouseRobot = (page: Page): WarehouseRobotValue => {
  const organizationName = page.getByTestId('warehouse-organization-name');
  const warehouseItems = page.getByTestId('warehouse-list-item');

  return {
    async expectEngineData(): Promise<void> {
      await expect(organizationName).toHaveText(ORGANIZATION_NAME);
      await expect(warehouseItems).toHaveText(WAREHOUSE_NAMES.map(name => new RegExp(`^${name}`)));
    },
  };
};
