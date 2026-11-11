import type { Page } from '@playwright/test';

import { fileURLToPath } from 'node:url';

import { PERSONAS } from './fixtures/demoData.ts';
import { toSectionHash } from './fixtures/routes.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const WAREHOUSE_1 = '80000004-0000-4000-8000-000000000000';
const WAREHOUSE_2 = '80000011-0000-4000-8000-000000000000';

const preview = async (page: Page, filename: string): Promise<void> => {
  const path = new URL(`./fixtures/${filename}`, import.meta.url);
  await page.getByTestId('warehouse-import-file-input').setInputFiles(fileURLToPath(path));
  await page.getByTestId('warehouse-import-preview').click();
  await expect(page.getByTestId('warehouse-import-status')).toHaveText('Проверено');
};

const open = async (page: Page): Promise<void> => {
  await createPersonaRobot(page).openAsPersona(toSectionHash('warehouse'), PERSONAS.freshSupplier.id);
  await page.getByTestId('warehouse-import-open').click();
  await expect(page.getByTestId('warehouse-import-panel')).toBeVisible();
};

test('shows Excel row errors, then posts cells and opening stock to only the selected warehouse', async ({ page }) => {
  await open(page);
  const warehouse = page.getByTestId('warehouse-import-warehouse').getByRole('combobox');
  const template = page.getByTestId('warehouse-import-template').getByRole('combobox');
  await warehouse.selectOption(WAREHOUSE_1);
  await template.selectOption('warehouse_cells');

  await preview(page, 'warehouse-import-overlap.xlsx');
  await expect(page.getByTestId('warehouse-import-row-error').filter({ hasText: /4/u }).first()).toBeVisible();
  await expect(page.getByTestId('warehouse-import-commit')).toHaveCount(0);

  await preview(page, 'warehouse-import-cells.xlsx');
  await page.getByTestId('warehouse-import-commit').click();
  await expect(page.getByTestId('warehouse-import-status')).toHaveText('Загружено');

  await template.selectOption('opening_stock');
  await preview(page, 'warehouse-import-stock.xlsx');
  const observer = await page.context().newPage();
  try {
    await open(observer);
    await observer.getByTestId('warehouse-import-warehouse').getByRole('combobox').selectOption(WAREHOUSE_1);
    await observer.getByTestId('warehouse-import-template').getByRole('combobox').selectOption('opening_stock');
    const observerHistory = observer.getByTestId('warehouse-import-history');
    await expect(observerHistory).toContainText('Проверено');
    await page.getByTestId('warehouse-import-commit').click();
    await expect(observerHistory).toContainText('Загружено');
  }
  finally {
    await observer.close();
  }
  await expect(page.getByTestId('warehouse-import-status')).toHaveText('Загружено');
  await expect(page.getByTestId('warehouse-import-rollback')).toHaveCount(0);

  const history = page.getByTestId('warehouse-import-history');
  await expect(history).toContainText('warehouse-import-stock.xlsx');
  await warehouse.selectOption(WAREHOUSE_2);
  await expect(page.getByTestId('warehouse-import-status')).toHaveCount(0);
  await expect(history).not.toContainText('warehouse-import-stock.xlsx');

  await page.getByTestId('warehouse-import-close').click();
  await expect(page.getByTestId('warehouse-import-open')).toBeFocused();
});

test.describe('warehouse import on a narrow screen', () => {
  test.use({ colorScheme: 'dark', viewport: { height: 760, width: 360 } });

  test('downloads both Excel templates and keeps the controls within the panel', async ({ page }) => {
    await open(page);
    await page.getByTestId('warehouse-import-warehouse').getByRole('combobox').selectOption(WAREHOUSE_1);
    const template = page.getByTestId('warehouse-import-template').getByRole('combobox');
    for (const [id, filename] of [
      ['warehouse_cells', 'warehouse-cells-template.xlsx'],
      ['opening_stock', 'opening-stock-template.xlsx'],
    ] as const) {
      await template.selectOption(id);
      const pending = page.waitForEvent('download');
      await page.getByTestId('warehouse-import-template-xlsx').click();
      expect((await pending).suggestedFilename()).toBe(filename);
    }
    const panel = page.getByTestId('warehouse-import-panel');
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
});
