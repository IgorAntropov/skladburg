import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { createProfileMenuLocators } from './profile-menu-locators.ts';

export interface TopBarRobotValue {
  expectDocumentTheme: (theme: 'dark' | 'light') => Promise<void>;
  expectResetConfirmClosed: () => Promise<void>;
  expectResetConfirmOpen: () => Promise<void>;
  requestReset: () => Promise<void>;
  resetFromConfirm: () => Promise<void>;
}

export const createTopBarRobot = (page: Page): TopBarRobotValue => {
  const {
    button: profileButton,
    menu,
    resetItem,
  } = createProfileMenuLocators(page);
  const resetConfirm = page.getByTestId('reset-confirm');
  const acceptResetButton = page.getByTestId('reset-confirm-accept');

  return {
    async expectDocumentTheme(theme: 'dark' | 'light'): Promise<void> {
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    },
    async expectResetConfirmClosed(): Promise<void> {
      await expect(resetConfirm).toHaveCount(0);
    },
    async expectResetConfirmOpen(): Promise<void> {
      await expect(resetConfirm).toBeVisible();
    },
    async requestReset(): Promise<void> {
      await profileButton.click();
      await expect(menu).toBeVisible();
      await resetItem.click();
      await expect(menu).toHaveCount(0);
    },
    async resetFromConfirm(): Promise<void> {
      await acceptResetButton.click();
    },
  };
};
