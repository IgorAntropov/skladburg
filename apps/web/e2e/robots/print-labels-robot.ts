import type { Locator } from '@playwright/test';

import { expect } from '@playwright/test';

interface PrintPreviewValue {
  close: (isEscape?: boolean) => Promise<void>;
  getPages: () => Locator;
  getStyle: () => Locator;
  print: () => Promise<void>;
}

export const openPrintPreview = async (button: Locator): Promise<PrintPreviewValue> => {
  await button.click();
  const preview = button.page().getByTestId('print-labels-preview');
  const frame = preview.getByTestId('print-labels-frame');
  const submit = preview.getByTestId('print-labels-submit');
  await expect(submit).toBeEnabled();
  return {
    close: async (isEscape) => {
      if (isEscape === true) {
        await preview.getByTestId('print-labels-close').press('Escape');
      }
      else {
        await preview.getByTestId('print-labels-close').click();
      }
      await expect(button).toBeFocused();
    },
    getPages: () => frame.contentFrame().locator('article'),
    getStyle: () => frame.contentFrame().locator('style'),
    print: async () => {
      await frame.evaluate((element) => {
        if (element instanceof HTMLIFrameElement && element.contentWindow !== null) {
          element.contentWindow.print = (): void => {
            const count = Number(element.dataset.printCalls ?? 0);
            element.dataset.printCalls = String(count + 1);
          };
        }
      });
      await submit.click();
      await expect(frame).toHaveAttribute('data-print-calls', '1');
    },
  };
};
