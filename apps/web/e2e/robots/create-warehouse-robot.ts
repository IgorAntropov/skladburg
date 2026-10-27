import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import { expectNoAxeViolations } from '../fixtures/axe.ts';
import {
  NEW_WAREHOUSE,
  WAREHOUSE_NAMES,
} from '../fixtures/demoData.ts';

const IS_COARSE_POINTER_SCRIPT = 'window.matchMedia("(pointer: coarse)").matches';
const TOOLTIP_OPEN_STATE = /^(delayed|instant)-open$/;
const MIN_VISIBLE_REASON_WIDTH_PX = 40;

export interface CreateWarehouseRobotValue {
  cancel: () => Promise<void>;
  expectAnnouncement: () => Promise<void>;
  expectButtonExpanded: () => Promise<void>;
  expectButtonFocused: () => Promise<void>;
  expectCityErrorFocused: () => Promise<void>;
  expectDenialReasonOnTouch: () => Promise<void>;
  expectDenialTooltip: () => Promise<void>;
  expectDeniedButton: () => Promise<void>;
  expectInitialWarehouses: () => Promise<void>;
  expectListsHidden: () => Promise<void>;
  expectListsShown: () => Promise<void>;
  expectNameFocused: () => Promise<void>;
  expectNewWarehouseCount: (count: number) => Promise<void>;
  expectNoViolationsOfAccessibility: () => Promise<void>;
  expectPanelClosed: () => Promise<void>;
  expectPanelOpen: () => Promise<void>;
  expectWarehouseCount: (count: number) => Promise<void>;
  fillAddress: () => Promise<void>;
  fillName: () => Promise<void>;
  hoverButton: () => Promise<void>;
  openForm: () => Promise<void>;
  pressEnterInName: () => Promise<void>;
  pressOpenButton: () => Promise<void>;
  selectCity: () => Promise<void>;
  submit: () => Promise<void>;
}

export const createCreateWarehouseRobot = (page: Page): CreateWarehouseRobotValue => {
  const openButton = page.getByTestId('create-warehouse-button');
  const panel = page.getByTestId('create-warehouse-panel');
  const submitButton = page.getByTestId('create-warehouse-submit');
  const cancelButton = page.getByTestId('create-warehouse-cancel');
  const warehouseItems = page.getByTestId('warehouse-list-item');
  const newWarehouseItems = warehouseItems.filter({ hasText: NEW_WAREHOUSE.name });
  const nameField = panel.locator('[name="name"]');
  const cityField = panel.locator('[name="cityId"]');
  const addressField = panel.locator('[name="address"]');
  const announcement = page.locator('[aria-live="polite"]:not([data-testid="assistant-announcer"])');

  const getDescribedByIds = async (locator: Locator): Promise<string[]> => {
    await expect(locator).toHaveAttribute('aria-describedby', /\S/);
    const value = await locator.getAttribute('aria-describedby');

    return (value ?? '').split(/\s+/).filter(id => id !== '');
  };

  const getDescriptionLocator = async (locator: Locator): Promise<Locator> => {
    const ids = await getDescribedByIds(locator);
    const selector = ids.map(id => `[id="${id}"]`).join(', ');

    return page.locator(selector);
  };

  return {
    async cancel(): Promise<void> {
      await cancelButton.click();
    },
    async expectAnnouncement(): Promise<void> {
      await expect(announcement).toContainText(NEW_WAREHOUSE.name);
    },
    async expectButtonExpanded(): Promise<void> {
      await expect(openButton).toHaveAttribute('aria-expanded', 'true');
      await expect(openButton).toHaveAttribute('aria-controls', /.+/);
    },
    async expectButtonFocused(): Promise<void> {
      await expect(openButton).toBeFocused();
    },
    async expectCityErrorFocused(): Promise<void> {
      await expect(cityField).toHaveAttribute('aria-invalid', 'true');
      const descriptions = await getDescriptionLocator(cityField);

      await expect.poll(async () => (await descriptions.allTextContents()).some(text => text.trim() !== '')).toBe(true);
      await expect(cityField).toBeFocused();
    },
    async expectDenialReasonOnTouch(): Promise<void> {
      expect(await page.evaluate<boolean>(IS_COARSE_POINTER_SCRIPT)).toBe(true);

      const reason = await getDescriptionLocator(openButton);

      await expect(reason).toHaveCount(1);
      await expect.poll(async () => (await reason.boundingBox())?.width ?? 0).toBeGreaterThan(MIN_VISIBLE_REASON_WIDTH_PX);
    },
    async expectDenialTooltip(): Promise<void> {
      await expect(openButton).toHaveAttribute('data-state', TOOLTIP_OPEN_STATE);
    },
    async expectDeniedButton(): Promise<void> {
      await expect(openButton).toBeVisible();
      await expect(openButton).toHaveAttribute('aria-disabled', 'true');
      const reason = await getDescriptionLocator(openButton);

      await expect(reason).toHaveCount(1);
    },
    async expectInitialWarehouses(): Promise<void> {
      await expect(warehouseItems).toHaveText(WAREHOUSE_NAMES.map(name => new RegExp(`^${name}`)));
    },
    async expectListsHidden(): Promise<void> {
      await expect(warehouseItems).toHaveCount(0);
    },
    async expectListsShown(): Promise<void> {
      await expect(warehouseItems.first()).toBeVisible();
    },
    async expectNameFocused(): Promise<void> {
      await expect(nameField).toBeFocused();
    },
    async expectNewWarehouseCount(count: number): Promise<void> {
      await expect(newWarehouseItems).toHaveCount(count);
    },
    async expectNoViolationsOfAccessibility(): Promise<void> {
      await expect(panel).toBeVisible();
      await expectNoAxeViolations(page);
    },
    async expectPanelClosed(): Promise<void> {
      await expect(panel).toHaveCount(0);
      await expect(openButton).toHaveAttribute('aria-expanded', 'false');
    },
    async expectPanelOpen(): Promise<void> {
      await expect(panel).toBeVisible();
    },
    async expectWarehouseCount(count: number): Promise<void> {
      await expect(warehouseItems).toHaveCount(count);
    },
    async fillAddress(): Promise<void> {
      await addressField.fill(NEW_WAREHOUSE.address);
    },
    async fillName(): Promise<void> {
      await nameField.fill(NEW_WAREHOUSE.name);
    },
    async hoverButton(): Promise<void> {
      await openButton.hover();
    },
    async openForm(): Promise<void> {
      await openButton.click();
      await expect(panel).toBeVisible();
      await expect(nameField).toBeFocused();
    },
    async pressEnterInName(): Promise<void> {
      await nameField.press('Enter');
    },
    async pressOpenButton(): Promise<void> {
      await openButton.click({ force: true });
    },
    async selectCity(): Promise<void> {
      await cityField.selectOption({ label: NEW_WAREHOUSE.cityName });
    },
    async submit(): Promise<void> {
      await submitButton.click();
    },
  };
};
