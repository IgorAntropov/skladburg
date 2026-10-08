import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import {
  ORGANIZATION_NAME,
  WAREHOUSE_NAMES,
} from '../fixtures/demoData.ts';
import { getText } from '../fixtures/messages.ts';

export interface WarehouseRobotValue {
  expectEngineData: () => Promise<void>;
  expectWarehouses: (organizationName: string, warehouseNames: readonly string[]) => Promise<void>;
}

export const createWarehouseRobot = (page: Page): WarehouseRobotValue => {
  const main = page.getByRole('main');
  const organizationCard = main.getByRole('region', { name: getText('warehouse.organization.title') });
  const warehouseList = main.getByRole('region', { name: getText('warehouse.warehouses.title') });

  const expectWarehouses = async (organizationName: string, warehouseNames: readonly string[]): Promise<void> => {
    await expect(organizationCard.getByRole('heading', { level: 2 })).toHaveText(organizationName);
    await expect(warehouseList.getByRole('listitem')).toHaveText(warehouseNames.map(name => new RegExp(`^${name}`)));
    await expect(warehouseList.getByText(getText('warehouse.warehouses.empty'))).toHaveCount(0);
  };

  return {
    async expectEngineData(): Promise<void> {
      await expectWarehouses(ORGANIZATION_NAME, WAREHOUSE_NAMES);
    },
    expectWarehouses,
  };
};
