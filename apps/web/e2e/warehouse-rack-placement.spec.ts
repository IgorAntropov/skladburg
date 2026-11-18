import { expectNoAxeViolations } from './fixtures/axe.ts';
import { PERSONAS } from './fixtures/demoData.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { openPrintPreview } from './robots/print-labels-robot.ts';
import { CUSTOMER_WAREHOUSE_HASH } from './robots/warehouse-delivery-robot.ts';

test.use({ reducedMotion: 'reduce' });

test('places a rack, restores its four addresses after reload and prints their labels', async ({ browserName, page }) => {
  const isDesktop = browserName === 'chromium';
  const colorScheme = isDesktop ? 'light' : 'dark';
  await page.setViewportSize(isDesktop ? DESKTOP_VIEWPORT : { height: 844, width: 390 });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.emulateMedia({ colorScheme });

  const persona = createPersonaRobot(page);
  await persona.openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshCustomer.id);

  const workspace = page.getByTestId('warehouse-workspace');
  const layoutTab = workspace.locator('button[id$="-trigger-layout"]');
  const addressesTab = workspace.locator('button[id$="-trigger-addresses"]');
  await layoutTab.click();

  const placement = workspace.getByTestId('warehouse-rack-placement');
  const previewAddresses = placement.getByTestId('warehouse-rack-preview').locator('li');
  await expect(previewAddresses).toHaveCount(4);
  await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
  const expectedAddresses = (await previewAddresses.allTextContents()).map(text => text.trim());
  expect(expectedAddresses.every(code => /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/u.test(code))).toBe(true);
  expect(new Set(expectedAddresses).size).toBe(4);
  await expect(page.locator('canvas')).toHaveCount(0);
  if (browserName === 'chromium') {
    await expectNoAxeViolations(page);
  }

  const submit = placement.getByTestId('warehouse-rack-submit');
  if (isDesktop) {
    await submit.press('Enter');
  }
  else {
    await submit.click();
  }
  await expect(placement.getByTestId('warehouse-rack-saved')).toBeVisible();
  const addedRackPrint = await openPrintPreview(placement.getByTestId('warehouse-rack-print'));
  await expect(addedRackPrint.getPages().locator('h1')).toHaveText(expectedAddresses);
  await addedRackPrint.close();

  await page.reload();
  await addressesTab.click();
  const addressList = workspace.getByTestId('warehouse-addresses');
  const savedCells = expectedAddresses.map(code =>
    addressList.locator('a[href^="#/cells/"]').filter({ hasText: new RegExp(`(?:^|\\s)${code}$`, 'u') }));
  for (const cell of savedCells) {
    await expect(cell).toHaveCount(1);
  }
  const [firstCell] = savedCells;
  if (firstCell === undefined) {
    throw new Error('The new rack has no cell to open');
  }
  await firstCell.click();
  await addressesTab.click();
  const restoredRackPrint = await openPrintPreview(workspace.getByTestId('warehouse-print-rack'));
  expect(await restoredRackPrint.getStyle().textContent()).toContain('size: 58mm 40mm');
  await expect(restoredRackPrint.getPages().locator('h1')).toHaveText(expectedAddresses);
  await restoredRackPrint.print();
  await restoredRackPrint.close();

  await persona.selectPersona(PERSONAS.freshStorekeeper);
  await expect(workspace).toBeVisible();
  await expect(addressesTab).toBeVisible();
  await expect(layoutTab).toHaveCount(0);
});
