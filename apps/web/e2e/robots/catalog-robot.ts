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
const OWN_TAB_NAME = 'Мой каталог';
const PRICE_SAVED_TEXT = 'Сохранено';
const DRAFT_BADGE_TEXT = 'Черновик';
const PUBLISHED_BADGE_TEXT = 'Опубликована';

export interface CatalogRobotValue {
  changeDestination: (site: NetworkSiteValue) => Promise<void>;
  expectAutoConfirmSwitch: (isChecked: boolean) => Promise<void>;
  expectDestination: (site: NetworkSiteValue) => Promise<void>;
  expectEditorOpen: () => Promise<void>;
  expectInspectorCityAvailability: (cityName: string) => Promise<void>;
  expectInspectorOpen: (productName: string) => Promise<void>;
  expectInspectorQuote: (quote: ShowcaseQuoteValue) => Promise<void>;
  expectNoViolationsOfAccessibility: () => Promise<void>;
  expectOwnListingPublication: (listingId: string, isPublished: boolean) => Promise<void>;
  expectOwnOpen: () => Promise<void>;
  expectOwnRowVisible: (listingId: string) => Promise<void>;
  expectPriceSaved: () => Promise<void>;
  expectRowAbsent: (listingId: string) => Promise<void>;
  expectRowCount: (count: number) => Promise<void>;
  expectRowCountBelow: (count: number) => Promise<void>;
  expectRowQuote: (listingId: string, quote: ShowcaseQuoteValue) => Promise<void>;
  expectRowUnitPrice: (listingId: string, unitPriceText: string) => Promise<void>;
  expectRowVisible: (listingId: string) => Promise<void>;
  expectSalesTermsAutoConfirm: (text: string) => Promise<void>;
  expectSalesTermsCardVisible: () => Promise<void>;
  expectShowcaseOpen: () => Promise<void>;
  expectSphere: (sphereId: string) => Promise<void>;
  fillTierPrice: (index: number, text: string) => Promise<void>;
  openEditor: () => Promise<void>;
  openListing: (listingId: string) => Promise<void>;
  openOwnListing: (listingId: string) => Promise<void>;
  openOwnTab: () => Promise<void>;
  openSalesTermsForm: () => Promise<void>;
  openShowcaseTab: () => Promise<void>;
  readRowCount: () => Promise<number>;
  savePrice: () => Promise<void>;
  saveSalesTerms: () => Promise<void>;
  search: (text: string) => Promise<void>;
  selectSphere: (sphereId: string) => Promise<void>;
  toggleAutoConfirm: () => Promise<void>;
  togglePublication: () => Promise<void>;
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
  const ownBody = page.getByTestId('catalog-tab-own');
  const editor = page.getByTestId('listing-editor');
  const priceForm = page.getByTestId('listing-price-form');
  const publishButton = page.getByTestId('listing-publish');
  const salesTermsCard = page.getByTestId('sales-terms-card');
  const salesTermsForm = page.getByTestId('sales-terms-form');
  const autoConfirmRow = page.getByTestId('sales-terms-auto-confirm');
  const autoConfirmSwitch = autoConfirmRow.getByRole('switch');

  const getRow = (listingId: string): Locator => page.getByTestId(`catalog-showcase-row-${listingId}`);

  const getOwnRow = (listingId: string): Locator => page.getByTestId(`own-listing-row-${listingId}`);

  const getTierPriceInput = (index: number): Locator => page.getByTestId(`listing-tier-${String(index)}-price`).locator('input');

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
    async expectAutoConfirmSwitch(isChecked: boolean): Promise<void> {
      await expect(salesTermsForm).toBeVisible();

      if (isChecked) {
        await expect(autoConfirmSwitch).toBeChecked();
      }
      else {
        await expect(autoConfirmSwitch).not.toBeChecked();
      }
    },
    async expectDestination({ cityName, label }: NetworkSiteValue): Promise<void> {
      await ensureFiltersVisible();
      await expect(destinationSelect.locator('option:checked')).toHaveText(`${label}, ${cityName}`);
    },
    async expectEditorOpen(): Promise<void> {
      await expect(editor).toBeVisible();
      await expect(getTierPriceInput(0)).toBeVisible();
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
    async expectOwnListingPublication(listingId: string, isPublished: boolean): Promise<void> {
      await expect(page.getByTestId(`own-listing-publication-${listingId}`)).toHaveText(
        isPublished ? PUBLISHED_BADGE_TEXT : DRAFT_BADGE_TEXT,
      );
    },
    async expectOwnOpen(): Promise<void> {
      await expect(page.getByRole('tab', { name: OWN_TAB_NAME, selected: true })).toBeVisible();
      await expect(ownBody).toBeVisible();
      await expect(ownBody.getByTestId(/^own-listing-row-/).first()).toBeVisible();
    },
    async expectOwnRowVisible(listingId: string): Promise<void> {
      await expect(getOwnRow(listingId)).toBeVisible();
    },
    async expectPriceSaved(): Promise<void> {
      await expect(priceForm.getByText(PRICE_SAVED_TEXT, { exact: true })).toBeVisible();
    },
    async expectRowAbsent(listingId: string): Promise<void> {
      await expect(getRow(listingId)).toHaveCount(0);
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
    async expectRowUnitPrice(listingId: string, unitPriceText: string): Promise<void> {
      await expect(getRow(listingId)).toContainText(unitPriceText);
    },
    async expectRowVisible(listingId: string): Promise<void> {
      await expect(getRow(listingId)).toBeVisible();
    },
    async expectSalesTermsAutoConfirm(text: string): Promise<void> {
      await expect(salesTermsCard).toBeVisible();
      await expect(salesTermsCard.locator('dd').filter({ hasText: text })).toHaveCount(1);
    },
    async expectSalesTermsCardVisible(): Promise<void> {
      await expect(salesTermsCard).toBeVisible();
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
    async fillTierPrice(index: number, text: string): Promise<void> {
      await getTierPriceInput(index).fill(text);
      await expect(getTierPriceInput(index)).toHaveValue(text);
    },
    async openEditor(): Promise<void> {
      await inspector.getByTestId('listing-edit').click();
    },
    async openListing(listingId: string): Promise<void> {
      await getRow(listingId).click();
    },
    async openOwnListing(listingId: string): Promise<void> {
      await getOwnRow(listingId).click();
      await expect(inspector.getByTestId('listing-edit')).toBeVisible();
    },
    async openOwnTab(): Promise<void> {
      await page.getByRole('tab', { name: OWN_TAB_NAME }).click();
    },
    async openSalesTermsForm(): Promise<void> {
      await salesTermsCard.getByTestId('sales-terms-edit').click();
      await expect(salesTermsForm).toBeVisible();
    },
    async openShowcaseTab(): Promise<void> {
      await showcaseTab.click();
    },
    async readRowCount(): Promise<number> {
      return rows.count();
    },
    async savePrice(): Promise<void> {
      await page.getByTestId('listing-save-price').click();
    },
    async saveSalesTerms(): Promise<void> {
      await page.getByTestId('sales-terms-save').click();
      await expect(salesTermsForm).toHaveCount(0);
    },
    async search(text: string): Promise<void> {
      await searchInput.fill(text);
    },
    async selectSphere(sphereId: string): Promise<void> {
      await ensureFiltersVisible();
      await sphereSelect.selectOption({ value: sphereId });
    },
    async toggleAutoConfirm(): Promise<void> {
      await autoConfirmRow.click();
    },
    async togglePublication(): Promise<void> {
      await publishButton.click();
    },
  };
};
