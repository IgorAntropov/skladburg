import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { createProfileMenuLocators } from './profile-menu-locators.ts';

export interface TopBarRobotValue {
  expectActiveSearchOption: () => Promise<void>;
  expectDocumentTheme: (theme: 'dark' | 'light') => Promise<void>;
  expectResetConfirmClosed: () => Promise<void>;
  expectResetConfirmOpen: () => Promise<void>;
  expectSearchGroups: (groupIds: readonly string[]) => Promise<void>;
  openSearchBySlash: () => Promise<void>;
  requestReset: () => Promise<void>;
  resetFromConfirm: () => Promise<void>;
  typeSearchQuery: (text: string) => Promise<void>;
}

export const createTopBarRobot = (page: Page): TopBarRobotValue => {
  const {
    button: profileButton,
    menu,
    resetItem,
  } = createProfileMenuLocators(page);
  const resetConfirm = page.getByTestId('reset-confirm');
  const acceptResetButton = page.getByTestId('reset-confirm-accept');
  const searchInput = page.getByTestId('global-search-input');
  const searchPanel = page.getByTestId('global-search-panel');

  return {
    async expectActiveSearchOption(): Promise<void> {
      await expect(searchInput).toHaveAttribute('aria-activedescendant', /.+/);

      const activeOptionId = await searchInput.getAttribute('aria-activedescendant');
      const selectedOptions = searchPanel.getByRole('option', { selected: true });

      await expect(selectedOptions).toHaveCount(1);
      await expect(selectedOptions).toHaveAttribute('id', activeOptionId ?? '');
    },
    async expectDocumentTheme(theme: 'dark' | 'light'): Promise<void> {
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    },
    async expectResetConfirmClosed(): Promise<void> {
      await expect(resetConfirm).toHaveCount(0);
    },
    async expectResetConfirmOpen(): Promise<void> {
      await expect(resetConfirm).toBeVisible();
    },
    async expectSearchGroups(groupIds: readonly string[]): Promise<void> {
      await expect(searchPanel).toBeVisible();

      for (const groupId of groupIds) {
        await expect(searchPanel.getByTestId(`global-search-group-${groupId}`)).toBeVisible();
      }
    },
    async openSearchBySlash(): Promise<void> {
      await expect(profileButton).toBeVisible();

      await expect(async () => {
        const isInputFocused = await searchInput.and(page.locator(':focus')).count() === 1;

        if (!isInputFocused) {
          await page.keyboard.press('/');
        }

        await expect(searchInput).toBeFocused({ timeout: 1000 });
        await expect(searchInput).toHaveAttribute('aria-expanded', 'true', { timeout: 3000 });
      }).toPass({ timeout: 15_000 });
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
    async typeSearchQuery(text: string): Promise<void> {
      await searchInput.fill(text);
      await expect(searchInput).toHaveValue(text);
    },
  };
};
