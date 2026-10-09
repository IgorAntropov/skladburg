import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import {
  ORGANIZATION_NAME,
  WAREHOUSE_NAMES,
} from '../fixtures/demoData.ts';
import { getText } from '../fixtures/messages.ts';
import {
  createDelayEngineRequestScript,
  createReadContainsFocusScript,
  createReadHeightsScript,
  createReadOverflowScript,
} from '../fixtures/pageScripts.ts';

const SAME_HEIGHT_TOLERANCE_PX = 1;

const LIST_SELECTOR = '[data-testid="warehouse-list-scroll"]';

const PANEL_SELECTOR = '[data-testid="hud-zone-lists"] [role="tabpanel"][data-state="active"]';

const LOADED_CARD_SELECTOR = `${LIST_SELECTOR} li`;

const SKELETON_CARD_SELECTOR = `[role="status"][aria-label=${JSON.stringify(getText('warehouse.warehouses.loading'))}] > div > div`;

export interface WarehouseRobotValue {
  delayWarehouses: (delayMs: number) => Promise<void>;
  expectEngineData: () => Promise<void>;
  expectListScrollable: () => Promise<void>;
  expectOneFocusStopInList: () => Promise<void>;
  expectScrollIndicator: () => Promise<void>;
  expectSkeletonCardsOfLoadedCardHeight: () => Promise<void>;
  expectWarehouses: (organizationName: string, warehouseNames: readonly string[]) => Promise<void>;
  expectWarehousesTab: (count: number) => Promise<void>;
}

export const createWarehouseRobot = (page: Page): WarehouseRobotValue => {
  const main = page.getByRole('main');
  const organizationCard = main.getByRole('region', { name: getText('warehouse.organization.title') });
  const listsZone = page.getByTestId('hud-zone-lists');
  const warehouseList = main.getByRole('region', { name: getText('warehouse.warehouses.title') });
  const list = page.getByTestId('warehouse-list-scroll');
  const warehousesTab = listsZone.getByRole('tab', { name: new RegExp(`^${getText('hud.lists.warehouses')}`) });
  const panel = listsZone.getByRole('tabpanel');
  const skeletonGroup = main.getByRole('status', { exact: true, name: getText('warehouse.warehouses.loading') });

  const expectWarehouses = async (organizationName: string, warehouseNames: readonly string[]): Promise<void> => {
    await expect(organizationCard.getByRole('heading', { level: 2 })).toHaveText(organizationName);
    await expect(warehouseList.getByRole('listitem')).toHaveText(warehouseNames.map(name => new RegExp(`^${name}`)));
    await expect(warehouseList.getByText(getText('warehouse.warehouses.empty'))).toHaveCount(0);
  };

  return {
    async delayWarehouses(delayMs: number): Promise<void> {
      await page.addInitScript({ content: createDelayEngineRequestScript('ListWarehouses', delayMs) });
    },
    async expectEngineData(): Promise<void> {
      await expectWarehouses(ORGANIZATION_NAME, WAREHOUSE_NAMES);
    },
    async expectListScrollable(): Promise<void> {
      await expect.poll(() => page.evaluate<null | number>(createReadOverflowScript(PANEL_SELECTOR))).toBeGreaterThan(0);
    },
    async expectOneFocusStopInList(): Promise<void> {
      await expect(panel).toHaveAttribute('tabindex', '0');
      await expect(list).not.toHaveAttribute('tabindex', /.*/);
      await expect(list).not.toHaveAttribute('role', /.*/);

      await warehousesTab.focus();
      await expect(warehousesTab).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(panel).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(panel).not.toBeFocused();
      expect(await page.evaluate<boolean | null>(createReadContainsFocusScript(PANEL_SELECTOR)), 'the focus left the list').toBe(false);
    },
    async expectScrollIndicator(): Promise<void> {
      await expect(panel).toBeVisible();
      await expect(panel).toHaveCSS('overflow-y', 'auto');
      await expect(panel).toHaveCSS('background-image', /radial-gradient/);
      await expect(panel).toHaveCSS('background-attachment', /local/);
      await expect(list).toBeVisible();
      await expect(list).toHaveCSS('overflow-y', 'visible');
      await expect(list).toHaveCSS('background-image', 'none');
    },
    async expectSkeletonCardsOfLoadedCardHeight(): Promise<void> {
      const skeletonCards = skeletonGroup.locator(':scope > div > div');

      await expect(skeletonGroup).toBeVisible();
      await expect(skeletonCards).toHaveCount(WAREHOUSE_NAMES.length);

      const skeletonHeights = await page.evaluate<number[]>(createReadHeightsScript(SKELETON_CARD_SELECTOR));

      await expect(warehouseList.getByRole('listitem')).toHaveCount(WAREHOUSE_NAMES.length);
      await expect(skeletonGroup).toHaveCount(0);

      const cardHeights = await page.evaluate<number[]>(createReadHeightsScript(LOADED_CARD_SELECTOR));

      for (const skeletonHeight of skeletonHeights) {
        for (const cardHeight of cardHeights) {
          expect(Math.abs(skeletonHeight - cardHeight), `skeleton ${String(skeletonHeight)}, card ${String(cardHeight)}`)
            .toBeLessThanOrEqual(SAME_HEIGHT_TOLERANCE_PX);
        }
      }
    },
    expectWarehouses,
    async expectWarehousesTab(count: number): Promise<void> {
      const tab = listsZone.getByRole('tab', { exact: true, name: `${getText('hud.lists.warehouses')} ${String(count)}` });

      await expect(tab).toBeVisible();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    },
  };
};
