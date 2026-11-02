import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type {
  NetworkSiteValue,
  ShowcaseQuoteValue,
} from '../fixtures/demoData.ts';
import type { ObjectRouteValue } from '../fixtures/routes.ts';

import { expectNoAxeViolations } from '../fixtures/axe.ts';

const SHOWCASE_TAB_NAME = 'Витрина';

export interface CatalogRobotValue {
  changeDestination: (site: NetworkSiteValue) => Promise<void>;
  expectDestination: (site: NetworkSiteValue) => Promise<void>;
  expectInspectorCityAvailability: (cityName: string) => Promise<void>;
  expectInspectorOpen: (productName: string) => Promise<void>;
  expectInspectorQuote: (quote: ShowcaseQuoteValue) => Promise<void>;
  expectNoViolationsOfAccessibility: () => Promise<void>;
  expectRowCount: (count: number) => Promise<void>;
  expectRowCountBelow: (count: number) => Promise<void>;
  expectRowQuote: (listingId: string, quote: ShowcaseQuoteValue) => Promise<void>;
  expectRowVisible: (listingId: string) => Promise<void>;
  expectShowcaseOpen: () => Promise<void>;
  expectSphere: (sphereId: string) => Promise<void>;
  openListing: (listingId: string) => Promise<void>;
  openShowcaseTab: () => Promise<void>;
  readRowCount: () => Promise<number>;
  search: (text: string) => Promise<void>;
  selectSphere: (sphereId: string) => Promise<void>;
}

export const toListingRoute = (id: string): ObjectRouteValue => ({ id, section: 'catalog', segment: 'listings' });

export const createCatalogRobot = (page: Page): CatalogRobotValue => {
  const showcaseTab = page.getByRole('tab', { name: SHOWCASE_TAB_NAME });
  const showcaseBody = page.getByTestId('catalog-tab-showcase');
  const filtersToggle = page.getByTestId('catalog-filters-toggle');
  const searchInput = page.getByTestId('catalog-search').locator('input');
  const sphereSelect = page.getByTestId('catalog-sphere-filter').locator('select');
  const destinationSelect = page.getByTestId('catalog-destination-select').locator('select');
  const rows = page.getByTestId('catalog-showcase-list').getByTestId(/^catalog-showcase-row-/);
  const inspector = page.getByTestId('listing-inspector');

  const getRow = (listingId: string): Locator => page.getByTestId(`catalog-showcase-row-${listingId}`);

  const ensureFiltersVisible = async (): Promise<void> => {
    if (await filtersToggle.isVisible() && await filtersToggle.getAttribute('aria-expanded') !== 'true') {
      await filtersToggle.click();
    }

    await expect(sphereSelect).toBeVisible();
    await expect(destinationSelect).toBeVisible();
  };

  return {
    async changeDestination({ cityName, label }: NetworkSiteValue): Promise<void> {
      await ensureFiltersVisible();
      await destinationSelect.selectOption({ label: `${label}, ${cityName}` });
    },
    async expectDestination({ cityName, label }: NetworkSiteValue): Promise<void> {
      await ensureFiltersVisible();
      await expect(destinationSelect.locator('option:checked')).toHaveText(`${label}, ${cityName}`);
    },
    async expectInspectorCityAvailability(cityName: string): Promise<void> {
      await expect(inspector.getByTestId('listing-city-availability')).toContainText(cityName);
    },
    async expectInspectorOpen(productName: string): Promise<void> {
      await expect(inspector).toBeVisible();
      await expect(inspector.getByTestId('listing-quote')).toBeVisible();
      await expect(page.getByRole('heading', { exact: true, level: 2, name: productName })).toBeVisible();
    },
    async expectInspectorQuote({ etaText, totalText }: ShowcaseQuoteValue): Promise<void> {
      await expect(inspector.getByTestId('listing-quote-total')).toHaveText(totalText);
      await expect(inspector.getByTestId('listing-quote-eta')).toHaveText(etaText, { ignoreCase: true });
    },
    async expectNoViolationsOfAccessibility(): Promise<void> {
      await expectNoAxeViolations(page);
    },
    async expectRowCount(count: number): Promise<void> {
      await expect(rows).toHaveCount(count);
    },
    async expectRowCountBelow(count: number): Promise<void> {
      await expect.poll(() => rows.count()).toBeLessThan(count);
    },
    async expectRowQuote(listingId: string, { etaText, totalText }: ShowcaseQuoteValue): Promise<void> {
      const row = getRow(listingId);

      await expect(row).toContainText(totalText);
      await expect(row).toContainText(etaText, { ignoreCase: true });
    },
    async expectRowVisible(listingId: string): Promise<void> {
      await expect(getRow(listingId)).toBeVisible();
    },
    async expectShowcaseOpen(): Promise<void> {
      await expect(page.getByRole('tab', { name: SHOWCASE_TAB_NAME, selected: true })).toBeVisible();
      await expect(showcaseBody).toBeVisible();
      await expect(rows.first()).toBeVisible();
    },
    async expectSphere(sphereId: string): Promise<void> {
      await ensureFiltersVisible();
      await expect(sphereSelect).toHaveValue(sphereId);
    },
    async openListing(listingId: string): Promise<void> {
      await getRow(listingId).click();
    },
    async openShowcaseTab(): Promise<void> {
      await showcaseTab.click();
    },
    async readRowCount(): Promise<number> {
      return rows.count();
    },
    async search(text: string): Promise<void> {
      await searchInput.fill(text);
    },
    async selectSphere(sphereId: string): Promise<void> {
      await ensureFiltersVisible();
      await sphereSelect.selectOption({ value: sphereId });
    },
  };
};
