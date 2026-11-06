import { AvailabilityStatus } from '@skladburg/contracts/catalog/v1/catalog';
import { readFileSync } from 'node:fs';

import { PERSONAS } from './fixtures/demoData.ts';
import { toSectionHash } from './fixtures/routes.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createCatalogImportRobot } from './robots/catalog-import-robot.ts';
import { createCatalogRobot } from './robots/catalog-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const catalogCsv = readFileSync(new URL('./fixtures/catalog-import.csv', import.meta.url), 'utf8').trim();
const productName = 'Импортированный товар';

test.beforeEach(async ({ page }) => {
  await createPersonaRobot(page).openAsPersona(toSectionHash('catalog'), PERSONAS.freshSupplier.id);
  await createCatalogRobot(page).openOwnTab();
});

test('corrects a rejected row, loads a draft and rolls back the whole import', async ({ page }) => {
  const imports = createCatalogImportRobot(page);
  await imports.open();

  const rows = catalogCsv.split('\n');
  const invalidCsv = rows.map((row, index) => `${row};${index === 0 ? 'gtin' : '4601234567890'}`).join('\n');
  await imports.previewCsv(invalidCsv);
  await expect(page.getByTestId('catalog-import-row-error').first()).toContainText(/2.*GTIN/u);
  await expect(page.getByTestId('catalog-import-commit')).toHaveCount(0);

  await imports.previewCsv(catalogCsv);
  await page.getByTestId('catalog-import-commit').click();
  await expect(page.getByTestId('catalog-import-status')).toHaveText('Загружено');
  await imports.close();
  await expect(page.getByTestId('catalog-import-open')).toBeFocused();
  await page.getByTestId('catalog-own-search').getByRole('textbox').fill(productName);
  await expect(page.getByTestId('catalog-own-list')).toContainText(productName);
  await expect(page.getByTestId('catalog-own-list')).toContainText('Черновик');

  await imports.open();
  await imports.rollback();
  await expect(imports.history).toContainText('Отменена');
  await imports.close();
  await expect(page.getByTestId('catalog-own-list')).toHaveCount(0);
});

test('publishes through the editor and explains why the changed import cannot be rolled back', async ({ page }) => {
  const imports = createCatalogImportRobot(page);
  const catalog = createCatalogRobot(page);

  await imports.open();
  await imports.previewCsv(catalogCsv);
  await page.getByTestId('catalog-import-commit').click();
  await expect(page.getByTestId('catalog-import-status')).toHaveText('Загружено');
  await imports.close();

  const row = page.getByTestId(/^own-listing-row-/u).filter({ hasText: productName });
  await row.click();
  await catalog.openEditor();
  const editor = page.getByTestId('listing-editor');
  const warehouse = editor.getByTestId(/^listing-warehouse-.*-status$/u).first().getByRole('combobox');
  await warehouse.selectOption(String(AvailabilityStatus.ON_ORDER));
  await editor.getByTestId('listing-save').click();
  await expect(editor.getByRole('status')).toContainText('Сохранено');
  await catalog.togglePublication();
  await expect(row).toContainText('Опубликована');
  await editor.getByTestId('listing-editor-back').click();

  await imports.open();
  await imports.rollback();
  await expect(imports.history.getByRole('alert')).toContainText('данные уже изменены или использованы');
  await expect(imports.history).toContainText('Загружено');
});

test.describe('on a narrow dark screen', () => {
  test.use({ colorScheme: 'dark', viewport: { height: 760, width: 360 } });

  test('downloads and accepts the CSV and XLSX templates', async ({ page }) => {
    await createCatalogImportRobot(page).open();
    const input = page.getByTestId('catalog-import-file-input');
    const panel = page.getByTestId('catalog-import-panel');
    const fits = await panel.evaluate(element => element.scrollWidth <= element.clientWidth);
    expect(fits).toBe(true);

    for (const extension of ['csv', 'xlsx']) {
      const downloaded = page.waitForEvent('download');
      await page.getByTestId(`catalog-import-template-${extension}`).click();
      const template = await downloaded;
      expect(template.suggestedFilename()).toBe(`catalog-template.${extension}`);
      const path = await template.path();
      await input.setInputFiles({ buffer: readFileSync(path), mimeType: 'application/octet-stream', name: template.suggestedFilename() });
      await page.getByTestId('catalog-import-preview').click();
      await expect(page.getByTestId('catalog-import-status')).toHaveText('Проверено');
      await expect(page.getByTestId('catalog-import-commit')).toHaveCount(0);
    }
  });
});

test('keeps the previous supplier’s upload out of another supplier’s session', async ({ page }) => {
  const imports = createCatalogImportRobot(page);
  const persona = createPersonaRobot(page);
  const catalog = createCatalogRobot(page);

  await imports.open();
  await imports.previewCsv(catalogCsv);
  await expect(imports.history).toContainText('catalog.csv');
  await persona.selectPersona(PERSONAS.constructionSupplier);
  await catalog.openOwnTab();
  const open = page.getByTestId('catalog-import-open');
  if (await open.isVisible()) {
    await open.click();
  }
  await expect(imports.history).toBeVisible();
  await expect(imports.history).not.toContainText('catalog.csv');
  await expect(page.getByTestId('catalog-import-status')).toHaveCount(0);
});
