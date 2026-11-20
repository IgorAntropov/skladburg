import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import {
  ORGANIZATION_NAME,
  WAREHOUSE_NAMES,
} from '../fixtures/demoData.ts';

export interface WarehouseRobotValue {
  expectEngineData: () => Promise<void>;
  expectStaffCount: (areaId: string, count: number) => Promise<void>;
  expectStaffPlan: (areaId: string, planned: number, difference: number) => Promise<void>;
  expectStaffShift: (onShift: number, onBreak: number, offSite: number) => Promise<void>;
  openStaffTab: () => Promise<void>;
}

export const createWarehouseRobot = (page: Page): WarehouseRobotValue => {
  const organizationName = page.getByTestId('warehouse-organization-name');
  const warehouseItems = page.getByTestId('warehouse-list-item');
  const workspace = page.getByTestId('warehouse-workspace');

  return {
    async expectEngineData(): Promise<void> {
      await expect(organizationName).toHaveText(ORGANIZATION_NAME);
      await expect(warehouseItems).toHaveText(WAREHOUSE_NAMES.map(name => new RegExp(`^${name}`)));
    },
    async expectStaffCount(areaId: string, count: number): Promise<void> {
      await expect(workspace.getByTestId(`warehouse-staff-count-${areaId}`)).toHaveText(String(count));
    },
    async expectStaffPlan(areaId: string, planned: number, difference: number): Promise<void> {
      const signed = new Intl.NumberFormat('ru-RU', { signDisplay: 'exceptZero' }).format(difference);
      await expect(workspace.getByTestId(`warehouse-staff-plan-${areaId}`)).toHaveText(String(planned));
      await expect(workspace.getByTestId(`warehouse-staff-delta-${areaId}`)).toHaveText(signed);
    },
    async expectStaffShift(onShift: number, onBreak: number, offSite: number): Promise<void> {
      await expect(workspace.getByTestId('warehouse-staff-on-shift')).toHaveText(String(onShift));
      await expect(workspace.getByTestId('warehouse-staff-on-break')).toHaveText(String(onBreak));
      await expect(workspace.getByTestId('warehouse-staff-off-site')).toHaveText(String(offSite));
    },
    async openStaffTab(): Promise<void> {
      await workspace.locator('button[id$="-trigger-staff"]').click();
    },
  };
};
