import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import { expectNoAxeViolations } from '../fixtures/axe.ts';
import {
  SUPPORT_REPLY_TIMEOUT_MS,
  SUPPORT_TEXTS,
} from '../fixtures/demoData.ts';

export interface SupportRobotValue {
  chooseCategory: (optionLabel: string) => Promise<void>;
  closePanel: () => Promise<void>;
  expectCategory: (optionLabel: string) => Promise<void>;
  expectFormOpen: () => Promise<void>;
  expectHelpTabFocused: () => Promise<void>;
  expectNotificationOpenChatLink: () => Promise<void>;
  expectNoViolationsOfAccessibility: () => Promise<void>;
  expectPreviewHasNoText: (...texts: (RegExp | string)[]) => Promise<void>;
  expectPreviewRow: (label: string, value: RegExp | string) => Promise<void>;
  expectPreviewText: (text: string) => Promise<void>;
  expectReplicaOpenChatLink: () => Promise<void>;
  expectReply: () => Promise<void>;
  expectTab: (tab: SupportTabValue) => Promise<void>;
  expectTicket: (ticketNumber: string) => Promise<void>;
  expectTicketTitle: (ticketNumber: string, title: string) => Promise<void>;
  expectWaiting: () => Promise<void>;
  openChatFromNotificationRow: () => Promise<void>;
  openChatFromReplica: () => Promise<void>;
  openFormFromHelp: () => Promise<void>;
  openHelp: () => Promise<void>;
  openPanel: () => Promise<void>;
  selectTab: (tab: SupportTabValue) => Promise<void>;
  submit: () => Promise<void>;
}

export type SupportTabValue = 'help' | 'notifications';

export const createSupportRobot = (page: Page): SupportRobotValue => {
  const button = page.getByTestId('notification-center-button');
  const panel = page.getByTestId('notification-center-panel');
  const callButton = page.getByTestId('support-call-button');
  const form = page.getByTestId('support-call-form');
  const preview = page.getByTestId('support-call-preview');
  const submitButton = page.getByTestId('support-call-submit');
  const waiting = page.getByTestId('support-waiting');
  const reply = page.getByTestId('support-reply');
  const notificationOpenChatLink = panel.getByTestId('notification-center-link-open-chat');
  const replicaOpenChatLink = page.getByTestId('assistant-replica-link-open-chat');

  const getTab = (tab: SupportTabValue): Locator => {
    const name = tab === 'help' ? SUPPORT_TEXTS.tabHelp : SUPPORT_TEXTS.tabNotifications;

    return panel.getByRole('tab', { name });
  };

  const getCategorySelect = (): Locator => form.getByRole('combobox');

  const getPreviewRow = (label: string): Locator => preview.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd');

  const selectTab = async (tab: SupportTabValue): Promise<void> => {
    await getTab(tab).click();
    await expect(getTab(tab)).toHaveAttribute('aria-selected', 'true');
  };

  const openPanel = async (): Promise<void> => {
    await button.click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAccessibleName(SUPPORT_TEXTS.assistantName);
  };

  return {
    async chooseCategory(optionLabel: string): Promise<void> {
      await getCategorySelect().selectOption({ label: optionLabel });
    },
    async closePanel(): Promise<void> {
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
    },
    async expectCategory(optionLabel: string): Promise<void> {
      await expect(getCategorySelect().locator('option:checked')).toHaveText(optionLabel);
    },
    async expectFormOpen(): Promise<void> {
      await expect(form).toBeVisible();
      await expect(preview).toBeVisible();
      await expect(submitButton).toBeEnabled();
    },
    async expectHelpTabFocused(): Promise<void> {
      await expect(getTab('help')).toBeFocused();
    },
    async expectNotificationOpenChatLink(): Promise<void> {
      await expect(notificationOpenChatLink).toBeVisible({ timeout: SUPPORT_REPLY_TIMEOUT_MS });
    },
    async expectNoViolationsOfAccessibility(): Promise<void> {
      await expectNoAxeViolations(page);
    },
    async expectPreviewHasNoText(...texts: (RegExp | string)[]): Promise<void> {
      for (const text of texts) {
        await expect(preview).not.toContainText(text);
      }
    },
    async expectPreviewRow(label: string, value: RegExp | string): Promise<void> {
      await expect(getPreviewRow(label)).toContainText(value);
    },
    async expectPreviewText(text: string): Promise<void> {
      await expect(preview).toContainText(text);
    },
    async expectReplicaOpenChatLink(): Promise<void> {
      await expect(replicaOpenChatLink).toBeVisible({ timeout: SUPPORT_REPLY_TIMEOUT_MS });
    },
    async expectReply(): Promise<void> {
      await expect(reply).toBeVisible({ timeout: SUPPORT_REPLY_TIMEOUT_MS });
      await expect(reply).toContainText(SUPPORT_TEXTS.replyAuthor);
    },
    async expectTab(tab: SupportTabValue): Promise<void> {
      await expect(getTab(tab)).toHaveAttribute('aria-selected', 'true');
    },
    async expectTicket(ticketNumber: string): Promise<void> {
      await expect(page.getByTestId(`support-ticket-${ticketNumber}`)).toBeVisible();
    },
    async expectTicketTitle(ticketNumber: string, title: string): Promise<void> {
      await expect(page.getByTestId(`support-ticket-${ticketNumber}`)).toContainText(title);
    },
    async expectWaiting(): Promise<void> {
      await expect(waiting).toBeVisible();
    },
    async openChatFromNotificationRow(): Promise<void> {
      await notificationOpenChatLink.click();
      await expect(getTab('help')).toHaveAttribute('aria-selected', 'true');
    },
    async openChatFromReplica(): Promise<void> {
      await replicaOpenChatLink.click();
      await expect(panel).toBeVisible();
      await expect(getTab('help')).toHaveAttribute('aria-selected', 'true');
    },
    async openFormFromHelp(): Promise<void> {
      await callButton.click();
      await expect(form).toBeVisible();
    },
    async openHelp(): Promise<void> {
      await openPanel();
      await selectTab('help');
      await expect(callButton).toBeVisible();
    },
    openPanel,
    selectTab,
    async submit(): Promise<void> {
      await submitButton.click();
      await expect(form).toHaveCount(0);
    },
  };
};
