import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type { NetworkSiteValue } from '../fixtures/demoData.ts';

import { expectNoAxeViolations } from '../fixtures/axe.ts';
import {
  toCityRoute,
  toSiteRoute,
  toWarehouseRoute,
} from '../fixtures/routes.ts';

const OWN_GROUP_HEADING = 'Ваши площадки';
const NETWORK_GROUP_HEADING = 'Площадки сети';
const SITES_TAB_NAME = /^Склады/;
const NOT_FOUND_TITLE = 'Объект не найден';

export interface NetworkRobotValue {
  expectCityInspector: (cityName: string) => Promise<void>;
  expectCitySiteLinks: (sites: readonly NetworkSiteValue[]) => Promise<void>;
  expectMiniMapShown: () => Promise<void>;
  expectNoOwnGroup: () => Promise<void>;
  expectNotFoundInspector: () => Promise<void>;
  expectNoViolationsOfAccessibility: () => Promise<void>;
  expectOwnSitesFirst: (sites: readonly NetworkSiteValue[]) => Promise<void>;
  expectRowCount: (count: number) => Promise<void>;
  expectRowSelected: (siteId: string) => Promise<void>;
  expectSiteInspector: (site: NetworkSiteValue, sideName?: string) => Promise<void>;
  expectSitesTabOpen: () => Promise<void>;
  expectWarehouseOpened: (warehouseId: string) => Promise<void>;
  openCitySiteLink: (siteId: string) => Promise<void>;
  openWarehouse: () => Promise<void>;
  tapCityMarkers: (expectedCount: number) => Promise<void>;
  tapRow: (siteId: string) => Promise<void>;
}

export const createNetworkRobot = (page: Page): NetworkRobotValue => {
  const siteList = page.getByTestId('network-site-list');
  const rows = page.getByTestId('network-site-row');
  const inspectorBody = page.getByTestId('network-inspector-body');
  const openWarehouseButton = page.getByTestId('network-inspector-open-warehouse');
  const notFound = page.getByTestId('network-inspector-not-found');
  const cityLink = page.getByTestId('network-inspector-city-link');
  const citySiteLinks = page.getByTestId('network-city-site-link');
  const miniMap = page.getByTestId('network-mini-map');
  const cityMarkers = page.getByTestId('network-mini-map-city');

  const getRow = (siteId: string): Locator => rows.and(page.locator(`[data-site-id="${siteId}"]`));
  const getInspectorHeading = (title: string): Locator => page.getByRole('heading', { exact: true, level: 2, name: title });
  const getGroupHeading = (title: string): Locator => siteList.getByRole('heading', { level: 3, name: new RegExp(`^${title}`) });
  const expectAddress = async (hash: string): Promise<void> => {
    await expect.poll(() => new URL(page.url()).hash).toBe(hash);
  };

  return {
    async expectCityInspector(cityName: string): Promise<void> {
      await expect(getInspectorHeading(cityName)).toBeVisible();
      await expect(inspectorBody).toHaveAttribute('data-object-type', 'city');
    },
    async expectCitySiteLinks(sites: readonly NetworkSiteValue[]): Promise<void> {
      await expect(citySiteLinks).toHaveCount(sites.length);

      for (const [index, site] of sites.entries()) {
        await expect(citySiteLinks.nth(index)).toHaveAttribute('data-site-id', site.id);
        await expect(citySiteLinks.nth(index)).toContainText(site.label);
      }
    },
    async expectMiniMapShown(): Promise<void> {
      await expect(miniMap).toBeVisible();
      await expect(cityMarkers.first()).toBeVisible();
    },
    async expectNoOwnGroup(): Promise<void> {
      await expect(getGroupHeading(NETWORK_GROUP_HEADING)).toBeVisible();
      await expect(getGroupHeading(OWN_GROUP_HEADING)).toHaveCount(0);
    },
    async expectNotFoundInspector(): Promise<void> {
      await expect(notFound).toBeVisible();
      await expect(notFound).toContainText(NOT_FOUND_TITLE);
      await expect(inspectorBody).toHaveCount(0);
    },
    async expectNoViolationsOfAccessibility(): Promise<void> {
      await expectNoAxeViolations(page);
    },
    async expectOwnSitesFirst(sites: readonly NetworkSiteValue[]): Promise<void> {
      await expect(getGroupHeading(OWN_GROUP_HEADING)).toBeVisible();
      await expect(getGroupHeading(NETWORK_GROUP_HEADING)).toBeVisible();

      const firstIds = await Promise.all(sites.map((_, index) => rows.nth(index).getAttribute('data-site-id')));

      expect(firstIds.toSorted()).toEqual(sites.map(site => site.id).toSorted());
    },
    async expectRowCount(count: number): Promise<void> {
      await expect(rows).toHaveCount(count);
    },
    async expectRowSelected(siteId: string): Promise<void> {
      await expect(getRow(siteId)).toHaveAttribute('aria-current', 'true');
      await expect(rows.and(page.locator('[aria-current="true"]'))).toHaveCount(1);
    },
    async expectSiteInspector(site: NetworkSiteValue, sideName?: string): Promise<void> {
      await expect(getInspectorHeading(site.label)).toBeVisible();
      await expect(inspectorBody).toHaveAttribute('data-object-type', 'site');
      await expect(cityLink).toHaveText(site.cityName);

      if (sideName !== undefined) {
        await expect(inspectorBody).toContainText(sideName);
      }
    },
    async expectSitesTabOpen(): Promise<void> {
      await expect(siteList).toBeVisible();
      await expect(page.getByRole('tab', { name: SITES_TAB_NAME, selected: true })).toBeVisible();
    },
    async expectWarehouseOpened(warehouseId: string): Promise<void> {
      await expectAddress(`#/${toWarehouseRoute(warehouseId).segment}/${warehouseId}`);
      await expect(page.getByTestId('page-warehouse')).toBeVisible();
    },
    async openCitySiteLink(siteId: string): Promise<void> {
      await citySiteLinks.and(page.locator(`[data-site-id="${siteId}"]`)).click();
      await expectAddress(`#/${toSiteRoute(siteId).segment}/${siteId}`);
    },
    async openWarehouse(): Promise<void> {
      await openWarehouseButton.click();
    },
    async tapCityMarkers(expectedCount: number): Promise<void> {
      await expect(cityMarkers).toHaveCount(expectedCount);

      for (let index = 0; index < expectedCount; index += 1) {
        const marker = cityMarkers.nth(index);
        const cityId = (await marker.getAttribute('data-city-id')) ?? '';

        await marker.tap();
        await expectAddress(`#/${toCityRoute(cityId).segment}/${cityId}`);
        await expect(inspectorBody).toHaveAttribute('data-object-type', 'city');
        await expect(marker).toHaveAttribute('aria-current', 'true');
      }
    },
    async tapRow(siteId: string): Promise<void> {
      await getRow(siteId).click();
      await expectAddress(`#/${toSiteRoute(siteId).segment}/${siteId}`);
    },
  };
};
