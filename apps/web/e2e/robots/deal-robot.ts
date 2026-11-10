import type {
  Locator,
  Page,
} from '@playwright/test';
import type { DealStatus } from '@skladburg/contracts/deal/v1/deal';

import { expect } from '@playwright/test';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';

import { expectNoAxeViolations } from '../fixtures/axe.ts';
import { createNotificationRobot } from './notification-robot.ts';

const DRAFT_DATE = '2026-10-20';
const COUNTER_DATE = '2026-10-21';

const TAB_IDS = ['mine', 'active', 'closed'] as const;

interface DealRobotValue {
  acceptCounterOffer: () => Promise<void>;
  choosePickup: () => Promise<void>;
  confirm: (warehouseId: string) => Promise<void>;
  createDraft: (warehouseId: string, quantity: string, desiredDate?: string) => Promise<string>;
  discardCancellation: () => Promise<void>;
  expectCancellationReason: (reason: string) => Promise<void>;
  expectDraftsPrivate: () => Promise<void>;
  expectGoodsTotal: (amount: string) => Promise<void>;
  expectInMyQueue: (address: string) => Promise<void>;
  expectNoViolationsOfAccessibility: () => Promise<void>;
  expectStatus: (status: DealStatus, ...otherStatuses: DealStatus[]) => Promise<void>;
  expectSubmissionOverLimit: () => Promise<void>;
  expectUnavailable: () => Promise<void>;
  openFromSearch: (address: string, query: string) => Promise<void>;
  openReceivedNotification: (address: string) => Promise<void>;
  sendCounterOffer: (warehouseId: string, price: string) => Promise<void>;
  startCancellation: (reason: string) => Promise<void>;
  submitDraft: () => Promise<void>;
}

type DealTabValue = typeof TAB_IDS[number];

export const createDealRobot = (page: Page): DealRobotValue => {
  const board = page.getByTestId('deals-board');
  const inspector = page.getByTestId('deal-inspector');
  const order = page.getByTestId('order-form');
  const cancellation = inspector.getByTestId('deal-cancel-form');
  const cancellationReason = cancellation.locator('input');
  const counter = page.getByTestId('deal-counter-form');
  const submit = inspector.getByTestId('deal-submit');
  const notifications = createNotificationRobot(page);

  const getGroup = (tab: DealTabValue): Locator => board.getByTestId(`deals-group-${tab}`);

  const getTab = (tab: DealTabValue): Locator => board.locator(`button[id$="-trigger-${tab}"]`);

  const readAddress = (): string => new URL(page.url()).hash.split('?')[0] ?? '';

  return {
    async acceptCounterOffer(): Promise<void> {
      await inspector.getByTestId('deal-counter-accept').click();
    },
    async choosePickup(): Promise<void> {
      await inspector.getByTestId('deal-delivery-open').click();
      const delivery = inspector.getByTestId('deal-delivery-form');
      await delivery.locator('select').selectOption(String(DeliveryMethod.CUSTOMER));
      await delivery.getByTestId('deal-delivery-submit').click();
    },
    async confirm(warehouseId: string): Promise<void> {
      await inspector.getByTestId('deal-confirm').click();
      await inspector.getByTestId('deal-confirm-warehouse').locator('select').selectOption(warehouseId);
      await inspector.getByTestId('deal-confirm-submit').click();
    },
    async createDraft(warehouseId: string, quantity: string, desiredDate = DRAFT_DATE): Promise<string> {
      await page.getByTestId('order-open').click();
      await expect(order).toBeVisible();
      await expect(order.getByTestId('order-warehouse').locator('select')).toHaveValue(warehouseId);
      await order.getByTestId('order-quantity').locator('input').fill(quantity);
      await order.getByTestId('order-date').locator('input').fill(desiredDate);
      await order.getByTestId('order-create').click();
      await expect(inspector).toBeVisible();
      await expect.poll(readAddress).toMatch(/^#\/deals\/[\da-f-]{36}$/u);
      return readAddress();
    },
    async discardCancellation(): Promise<void> {
      await inspector.getByTestId('deal-editor-back').click();
      await inspector.getByTestId('deal-editor-leave-confirm-leave').click();
      await expect(cancellation).toBeHidden();
    },
    async expectCancellationReason(reason): Promise<void> {
      await expect(cancellationReason).toHaveValue(reason);
    },
    async expectDraftsPrivate(): Promise<void> {
      for (const tab of TAB_IDS) {
        await getTab(tab).click();
        await expect(getTab(tab)).toHaveAttribute('aria-selected', 'true');
        const group = getGroup(tab);
        await expect(group.getByTestId('deals-empty')).toBeVisible();
        await expect(group.getByTestId('deal-row')).toHaveCount(0);
      }
    },
    async expectGoodsTotal(amount: string): Promise<void> {
      await expect(inspector.getByTestId('deal-goods-total')).toHaveText(amount);
    },
    async expectInMyQueue(address: string): Promise<void> {
      await getTab('mine').click();
      await expect(getTab('mine')).toHaveAttribute('aria-selected', 'true');
      await expect(getGroup('mine').getByTestId('deal-row').and(page.locator(`[href="${address}"]`))).toBeVisible();
    },
    async expectNoViolationsOfAccessibility(): Promise<void> {
      await expect(inspector).toBeVisible();
      await expectNoAxeViolations(page);
    },
    async expectStatus(status, ...otherStatuses): Promise<void> {
      const pattern = new RegExp(`^(?:${[status, ...otherStatuses].join('|')})$`, 'u');
      await expect(inspector.getByTestId('deal-status')).toHaveAttribute('data-status', pattern);
    },
    async expectSubmissionOverLimit(): Promise<void> {
      await expect(submit).toBeVisible();
      await expect(submit).toBeDisabled();
      const reason = inspector.getByTestId('deal-limit-reason');
      await expect(reason).toBeVisible();
      await expect(reason).toContainText(/123\s033,60/u);
      await expect(reason).toContainText(/100\s000/u);
    },
    async expectUnavailable(): Promise<void> {
      await expect(inspector.getByTestId('deal-unavailable')).toBeVisible();
    },
    async openFromSearch(address: string, query: string): Promise<void> {
      const dealId = address.split('/').at(-1);
      await page.getByTestId('global-search-input').fill(query);
      await page.getByTestId(`global-search-option-deals-${dealId ?? ''}`).click();
      await expect.poll(readAddress).toBe(address);
    },
    async openReceivedNotification(address: string): Promise<void> {
      await notifications.open();
      const link = page.getByTestId('notification-center-link-open').and(page.locator(`[href="${address}"]`));
      const row = notifications.getRowWithData().filter({ has: link });
      await notifications.expectUnread(row);
      await notifications.openLink(row, 'open');
      await notifications.expectClosed();
      await expect.poll(readAddress).toBe(address);
    },
    async sendCounterOffer(warehouseId: string, price: string): Promise<void> {
      await inspector.getByTestId('deal-counter-open').click();
      await expect(counter).toBeVisible();
      await counter.getByTestId('deal-counter-warehouse').locator('select').selectOption(warehouseId);
      await counter.getByTestId('deal-counter-price-0').locator('input').fill(price);
      await counter.getByTestId('deal-counter-date').locator('input').fill(COUNTER_DATE);
      await counter.getByTestId('deal-counter-submit').click();
    },
    async startCancellation(reason): Promise<void> {
      await inspector.getByTestId('deal-cancel').click();
      await cancellationReason.fill(reason);
    },
    async submitDraft(): Promise<void> {
      await submit.click();
    },
  };
};
