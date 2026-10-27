import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import { expectNoAxeViolations } from '../fixtures/axe.ts';

export type NotificationLinkValue = 'map' | 'open' | 'organization';

export interface NotificationRobotValue {
  close: () => Promise<void>;
  expectButtonFocused: () => Promise<void>;
  expectClosed: () => Promise<void>;
  expectNoViolationsOfAccessibility: () => Promise<void>;
  expectOpen: () => Promise<void>;
  expectRead: (row: Locator) => Promise<void>;
  expectRowCount: (count: number) => Promise<void>;
  expectUnread: (row: Locator) => Promise<void>;
  expectUnreadCount: (count: number) => Promise<void>;
  getRowById: (notificationId: string) => Locator;
  getRowWithData: (...dataTexts: string[]) => Locator;
  markAllRead: () => Promise<void>;
  open: () => Promise<void>;
  openLink: (row: Locator, link: NotificationLinkValue) => Promise<void>;
}

export const createNotificationRobot = (page: Page): NotificationRobotValue => {
  const button = page.getByTestId('notification-center-button');
  const badge = page.getByTestId('notification-center-badge');
  const panel = page.getByTestId('notification-center-panel');
  const markAllReadButton = page.getByTestId('notification-center-mark-all');
  const rows = panel.locator('[data-testid^="notification-center-row-"]');
  const unreadRows = rows.and(page.locator('[data-state="unread"]'));

  return {
    async close(): Promise<void> {
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
    },
    async expectButtonFocused(): Promise<void> {
      await expect(button).toBeFocused();
    },
    async expectClosed(): Promise<void> {
      await expect(panel).toHaveCount(0);
      await expect(button).toHaveAttribute('aria-expanded', 'false');
    },
    async expectNoViolationsOfAccessibility(): Promise<void> {
      await expect(rows.first()).toBeVisible();
      await expectNoAxeViolations(page);
    },
    async expectOpen(): Promise<void> {
      await expect(panel).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(rows.first()).toBeVisible();
    },
    async expectRead(row: Locator): Promise<void> {
      await expect(row).toHaveCount(1);
      await expect(row).toHaveAttribute('data-state', 'read');
    },
    async expectRowCount(count: number): Promise<void> {
      await expect(rows).toHaveCount(count);
    },
    async expectUnread(row: Locator): Promise<void> {
      await expect(row).toHaveCount(1);
      await expect(row).toHaveAttribute('data-state', 'unread');
    },
    async expectUnreadCount(count: number): Promise<void> {
      if (count === 0) {
        await expect(badge).toHaveCount(0);

        return;
      }

      await expect(badge).toHaveText(String(count));
    },
    getRowById(notificationId: string): Locator {
      return panel.getByTestId(`notification-center-row-${notificationId}`);
    },
    getRowWithData(...dataTexts: string[]): Locator {
      return dataTexts.reduce((current, dataText) => current.filter({ hasText: dataText }), rows);
    },
    async markAllRead(): Promise<void> {
      await markAllReadButton.click();
      await expect(unreadRows).toHaveCount(0);
    },
    async open(): Promise<void> {
      await button.click();
      await expect(panel).toBeVisible();
      await expect(rows.first()).toBeVisible();
    },
    async openLink(row: Locator, link: NotificationLinkValue): Promise<void> {
      await row.getByTestId(`notification-center-link-${link}`).click();
      await expect(panel).toHaveCount(0);
    },
  };
};
