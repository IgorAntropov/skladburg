import type {
  Locator,
  Page,
} from '@playwright/test';

export interface CatalogImportRobotValue {
  close: () => Promise<void>;
  history: Locator;
  open: () => Promise<void>;
  previewCsv: (csv: string) => Promise<void>;
  rollback: () => Promise<void>;
}

export const createCatalogImportRobot = (page: Page): CatalogImportRobotValue => ({
  close: () => page.getByTestId('catalog-import-close').click(),
  history: page.getByTestId('catalog-import-history'),
  open: () => page.getByTestId('catalog-import-open').click(),
  previewCsv: async (csv) => {
    await page.getByTestId('catalog-import-file-input')
      .setInputFiles({ buffer: Buffer.from(csv), mimeType: 'text/csv', name: 'catalog.csv' });
    await page.getByTestId('catalog-import-preview').click();
  },
  rollback: async () => {
    await page.getByTestId('catalog-import-rollback').click();
    await page.getByTestId('catalog-import-confirm-rollback').click();
  },
});
