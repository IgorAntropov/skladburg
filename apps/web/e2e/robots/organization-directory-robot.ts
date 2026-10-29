import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type { DirectoryOrganizationValue } from '../fixtures/demoData.ts';
import type { ColorSchemeValue } from '../fixtures/themePreference.ts';

import { expectNoAxeViolations } from '../fixtures/axe.ts';
import { toOrganizationRoute } from '../fixtures/routes.ts';
import { createStoreSystemThemeScript } from '../fixtures/themePreference.ts';

const COMPANIES_TAB_NAME = 'Компании';
const SPHERES_CELL_INDEX = 2;
const OWN_MARK_TEXT = 'вы';
const REQUISITES_LABELS = ['Реквизиты', 'Юридическое название', 'ИНН', 'КПП', 'ОГРН'] as const;
const READ_NATURAL_WIDTH_SCRIPT = `document.querySelector('[data-testid="organization-card-logo"]')?.naturalWidth ?? 0`;
const LEVEL_FOUR_HINT = 'Надёжные партнёры появятся, когда в сети закроются первые сделки';

export interface DirectoryFiltersValue {
  close: () => Promise<void>;
  expectMinLevel: (level: number) => Promise<void>;
  expectOpen: () => Promise<void>;
  open: () => Promise<void>;
  reset: () => Promise<void>;
  selectMinLevel: (level: number) => Promise<void>;
  selectSide: (sideName: string) => Promise<void>;
  selectSphere: (sphereId: string) => Promise<void>;
}

export interface OrganizationDirectoryRobotValue {
  closeTable: () => Promise<void>;
  expectActiveFilterCount: (count: number) => Promise<void>;
  expectCardLogo: (organization: DirectoryOrganizationValue, theme: ColorSchemeValue) => Promise<void>;
  expectCompaniesTabOpen: () => Promise<void>;
  expectForeignCard: (organization: DirectoryOrganizationValue) => Promise<void>;
  expectLevelFourHint: () => Promise<void>;
  expectNoTableButton: () => Promise<void>;
  expectNoViolationsOfAccessibility: () => Promise<void>;
  expectOwnCard: (organization: DirectoryOrganizationValue) => Promise<void>;
  expectOwnMarkOnlyOn: (organization: DirectoryOrganizationValue) => Promise<void>;
  expectRowHovered: (organization: DirectoryOrganizationValue) => Promise<void>;
  expectRowNotHovered: (organization: DirectoryOrganizationValue) => Promise<void>;
  expectRows: (organizations: readonly DirectoryOrganizationValue[]) => Promise<void>;
  expectRowSelected: (organization: DirectoryOrganizationValue) => Promise<void>;
  expectSummary: (text: string) => Promise<void>;
  expectTableButtonFocused: () => Promise<void>;
  expectTableClosed: () => Promise<void>;
  expectTableOpen: () => Promise<void>;
  expectTableRows: (organizations: readonly DirectoryOrganizationValue[]) => Promise<void>;
  expectTableRowSelected: (organization: DirectoryOrganizationValue) => Promise<void>;
  followSystemTheme: () => Promise<void>;
  hoverRow: (organization: DirectoryOrganizationValue) => Promise<void>;
  openCompaniesTab: () => Promise<void>;
  openRow: (organization: DirectoryOrganizationValue) => Promise<void>;
  openTable: () => Promise<void>;
  switchColorScheme: (colorScheme: ColorSchemeValue) => Promise<void>;
  tabFilters: DirectoryFiltersValue;
  tableFilters: DirectoryFiltersValue;
  tapTableRowCell: (organization: DirectoryOrganizationValue) => Promise<void>;
}

interface AttributeHolderValue {
  getAttribute: (name: string) => null | string;
}

const readOrganizationIds = (rows: Locator): Promise<string[]> => rows.evaluateAll(
  (elements: readonly AttributeHolderValue[]) => elements.map(element => element.getAttribute('data-organization-id') ?? ''),
);

const createFilters = (scope: Locator, toggle: Locator | undefined): DirectoryFiltersValue => {
  const filters = scope.getByTestId('organization-directory-filters');
  const resetButton = scope.getByTestId('organization-directory-reset');

  return {
    async close(): Promise<void> {
      if (toggle !== undefined) {
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      }

      await expect(filters).toHaveCount(0);
    },
    async expectMinLevel(level: number): Promise<void> {
      await expect(filters.getByLabel('Проверка')).toHaveValue(String(level));
    },
    async expectOpen(): Promise<void> {
      await expect(filters).toBeVisible();
    },
    async open(): Promise<void> {
      if (toggle !== undefined) {
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      }

      await expect(filters).toBeVisible();
    },
    async reset(): Promise<void> {
      await resetButton.click();
      await expect(resetButton).toHaveCount(0);
    },
    async selectMinLevel(level: number): Promise<void> {
      await filters.getByLabel('Проверка').selectOption({ label: `От ${String(level)}` });
    },
    async selectSide(sideName: string): Promise<void> {
      await filters.getByLabel('Сторона').selectOption({ label: sideName });
    },
    async selectSphere(sphereId: string): Promise<void> {
      await filters.getByLabel('Сфера').selectOption({ value: sphereId });
    },
  };
};

export const createOrganizationDirectoryRobot = (page: Page): OrganizationDirectoryRobotValue => {
  const companiesTab = page.getByRole('tab', { name: COMPANIES_TAB_NAME });
  const tabPanel = page.getByTestId('network-companies-panel');
  const filtersToggle = tabPanel.getByTestId('organization-directory-filters-toggle');
  const tableButton = tabPanel.getByTestId('organization-directory-table-button');
  const tablePanel = page.getByTestId('organization-directory-panel');
  const closeTableButton = tablePanel.getByTestId('organization-directory-close');
  const listRows = tabPanel.getByTestId('network-company-list').getByTestId('network-company-row');
  const tableRows = tablePanel.getByTestId('organization-directory-table').getByTestId('network-company-row');
  const inspectorBody = page.getByTestId('network-inspector-body');
  const requisites = page.getByTestId('organization-requisites');

  const getListRow = (organization: DirectoryOrganizationValue): Locator =>
    listRows.and(page.locator(`[data-organization-id="${organization.id}"]`));
  const getTableRow = (organization: DirectoryOrganizationValue): Locator =>
    tableRows.and(page.locator(`[data-organization-id="${organization.id}"]`));
  const getInspectorHeading = (title: string): Locator => page.getByRole('heading', { exact: true, level: 2, name: title });

  const expectAddress = async (organization: DirectoryOrganizationValue): Promise<void> => {
    const { segment } = toOrganizationRoute(organization.id);

    await expect.poll(() => new URL(page.url()).hash).toBe(`#/${segment}/${organization.id}`);
  };

  const expectCard = async (organization: DirectoryOrganizationValue): Promise<void> => {
    await expect(getInspectorHeading(organization.name)).toBeVisible();
    await expect(inspectorBody).toHaveAttribute('data-object-type', 'organization');
    await expect(page.getByTestId('organization-profile-card').first()).toBeVisible();
  };

  return {
    async closeTable(): Promise<void> {
      await closeTableButton.click();
      await expect(tablePanel).toHaveCount(0);
    },
    async expectActiveFilterCount(count: number): Promise<void> {
      await expect(filtersToggle).toContainText(`Включено фильтров: ${String(count)}`);
    },
    async expectCardLogo(organization: DirectoryOrganizationValue, theme: ColorSchemeValue): Promise<void> {
      const logo = inspectorBody.getByTestId('organization-card-logo');

      await expect(logo).toHaveAttribute('src', new RegExp(`logos/${organization.logoKey}-${theme}\\.svg$`));
      await expect.poll(() => page.evaluate<number>(READ_NATURAL_WIDTH_SCRIPT)).toBeGreaterThan(0);
    },
    async expectCompaniesTabOpen(): Promise<void> {
      await expect(page.getByRole('tab', { name: COMPANIES_TAB_NAME, selected: true })).toBeVisible();
      await expect(tabPanel).toBeVisible();
    },
    async expectForeignCard(organization: DirectoryOrganizationValue): Promise<void> {
      await expectCard(organization);
      await expect(requisites).toHaveCount(0);

      await expect(inspectorBody).not.toContainText(organization.inn);
      await expect(inspectorBody).not.toContainText(`ООО «${organization.name}»`);

      for (const label of REQUISITES_LABELS) {
        await expect(inspectorBody.getByText(label, { exact: true })).toHaveCount(0);
      }
    },
    async expectLevelFourHint(): Promise<void> {
      await expect(listRows).toHaveCount(0);
      await expect(tabPanel.getByText(LEVEL_FOUR_HINT)).toBeVisible();
    },
    async expectNoTableButton(): Promise<void> {
      await expect(filtersToggle).toBeVisible();
      await expect(tableButton).toHaveCount(0);
    },
    async expectNoViolationsOfAccessibility(): Promise<void> {
      await expectNoAxeViolations(page);
    },
    async expectOwnCard(organization: DirectoryOrganizationValue): Promise<void> {
      await expectCard(organization);
      await expect(requisites).toBeVisible();
      await expect(requisites).toContainText(organization.inn);
      await expect(requisites).toContainText(`ООО «${organization.name}»`);
    },
    async expectOwnMarkOnlyOn(organization: DirectoryOrganizationValue): Promise<void> {
      const marks = tabPanel.getByTestId('network-company-list').getByText(OWN_MARK_TEXT, { exact: true });

      await expect(marks).toHaveCount(1);
      await expect(getListRow(organization).getByText(OWN_MARK_TEXT, { exact: true })).toBeVisible();
    },
    async expectRowHovered(organization: DirectoryOrganizationValue): Promise<void> {
      await expect(getListRow(organization)).toHaveAttribute('data-hovered', 'true');
    },
    async expectRowNotHovered(organization: DirectoryOrganizationValue): Promise<void> {
      await expect(getListRow(organization)).not.toHaveAttribute('data-hovered', 'true');
    },
    async expectRows(organizations: readonly DirectoryOrganizationValue[]): Promise<void> {
      await expect.poll(() => readOrganizationIds(listRows)).toEqual(organizations.map(({ id }) => id));

      for (const [index, organization] of organizations.entries()) {
        await expect(listRows.nth(index)).toContainText(organization.name);
      }
    },
    async expectRowSelected(organization: DirectoryOrganizationValue): Promise<void> {
      await expect(getListRow(organization)).toHaveAttribute('aria-current', 'true');
      await expect(listRows.and(page.locator('[aria-current="true"]'))).toHaveCount(1);
    },
    async expectSummary(text: string): Promise<void> {
      const summary = tabPanel.getByText(text, { exact: true });

      await expect(summary).toBeVisible();

      const box = await summary.boundingBox();

      expect(box?.height ?? 0).toBeGreaterThan(0);
    },
    async expectTableButtonFocused(): Promise<void> {
      await expect(tableButton).toBeFocused();
      await expect(tableButton).toHaveAttribute('aria-expanded', 'false');
    },
    async expectTableClosed(): Promise<void> {
      await expect(tablePanel).toHaveCount(0);
    },
    async expectTableOpen(): Promise<void> {
      await expect(tablePanel).toBeVisible();
      await expect(tablePanel.getByRole('heading', { level: 2, name: 'Справочник компаний' })).toBeVisible();
      await expect(tablePanel.getByTestId('organization-directory-table')).toBeVisible();
      await expect(tableButton).toHaveAttribute('aria-expanded', 'true');
    },
    async expectTableRows(organizations: readonly DirectoryOrganizationValue[]): Promise<void> {
      await expect.poll(() => readOrganizationIds(tableRows)).toEqual(organizations.map(({ id }) => id));

      for (const [index, organization] of organizations.entries()) {
        await expect(tableRows.nth(index)).toContainText(organization.name);
      }
    },
    async expectTableRowSelected(organization: DirectoryOrganizationValue): Promise<void> {
      await expect(getTableRow(organization).getByRole('link')).toHaveAttribute('aria-current', 'true');
    },
    async followSystemTheme(): Promise<void> {
      await page.addInitScript({ content: createStoreSystemThemeScript() });
    },
    async hoverRow(organization: DirectoryOrganizationValue): Promise<void> {
      await getListRow(organization).hover();
    },
    async openCompaniesTab(): Promise<void> {
      await companiesTab.click();
      await expect(companiesTab).toHaveAttribute('data-state', 'active');
      await expect(tabPanel).toBeVisible();
    },
    async openRow(organization: DirectoryOrganizationValue): Promise<void> {
      await getListRow(organization).click();
      await expectAddress(organization);
    },
    async openTable(): Promise<void> {
      await tableButton.click();
    },
    async switchColorScheme(colorScheme: ColorSchemeValue): Promise<void> {
      await page.emulateMedia({ colorScheme });
    },
    tabFilters: createFilters(tabPanel, filtersToggle),
    tableFilters: createFilters(tablePanel, undefined),
    async tapTableRowCell(organization: DirectoryOrganizationValue): Promise<void> {
      const cell = getTableRow(organization).locator('td').nth(SPHERES_CELL_INDEX);

      await cell.scrollIntoViewIfNeeded();

      const box = await cell.boundingBox();

      expect(box).not.toBeNull();

      if (box !== null) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }

      await expectAddress(organization);
    },
  };
};
