import { expectNoAxeViolations } from './fixtures/axe.ts';
import { NEW_WAREHOUSE } from './fixtures/demoData.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import { createCreateWarehouseRobot } from './robots/create-warehouse-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { openPrintPreview } from './robots/print-labels-robot.ts';

const ZONE_X_MM = '1800';
const ZONE_Z_MM = '1400';
const CELL_CODES = ['Z01-R01-S01-Y01-C01', 'Z01-R01-S01-Y01-C02', 'Z01-R01-S01-Y02-C01', 'Z01-R01-S01-Y02-C02'];

test.use({ hasTouch: true, initialGraphicsPreference: 'off', reducedMotion: 'reduce' });

test('sets up the first storage zone of a new warehouse and prints its rack addresses', async ({ browserName, page }) => {
  const isPhone = browserName === 'webkit';
  const colorScheme = isPhone ? 'light' : 'dark';
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.emulateMedia({ colorScheme });
  await page.setViewportSize(isPhone ? PHONE_VIEWPORT : DESKTOP_VIEWPORT);

  const warehouse = createCreateWarehouseRobot(page);
  const navigation = createNavigationRobot(page);
  await navigation.openSection('warehouse');
  await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
  await warehouse.openForm();
  await warehouse.fillName();
  await warehouse.selectCity();
  await warehouse.submit();
  await warehouse.expectPanelClosed();
  await warehouse.expectNewWarehouseCount(1);
  await page.getByTestId('warehouse-list-item').filter({ hasText: NEW_WAREHOUSE.name }).getByTestId('warehouse-workspace-open').click();

  const workspace = page.getByTestId('warehouse-workspace');
  const layoutTab = workspace.locator('button[id$="-trigger-layout"]');
  const addressesTab = workspace.locator('button[id$="-trigger-addresses"]');
  await layoutTab.click();

  const setup = workspace.getByTestId('warehouse-layout-initialize');
  await setup.getByTestId('warehouse-layout-warehouse-width').locator('input').fill('14000');
  await setup.getByTestId('warehouse-layout-warehouse-depth').locator('input').fill('9000');
  await setup.getByTestId('warehouse-layout-zone-x').locator('input').fill(ZONE_X_MM);
  await setup.getByTestId('warehouse-layout-zone-z').locator('input').fill(ZONE_Z_MM);
  await setup.getByTestId('warehouse-layout-zone-width').locator('input').fill('5000');
  await setup.getByTestId('warehouse-layout-zone-depth').locator('input').fill('3000');
  if (!isPhone) {
    await expectNoAxeViolations(page);
  }
  const createZone = setup.getByTestId('warehouse-layout-initialize-submit');
  if (isPhone) {
    await createZone.tap();
  }
  else {
    await createZone.click();
  }

  const placement = workspace.getByTestId('warehouse-rack-placement');
  const grid = placement.getByTestId('warehouse-rack-grid');
  const selection = grid.getByTestId('warehouse-rack-grid-selection');
  const zone = grid.getByTestId('warehouse-rack-grid-zone');
  await expect(zone).toBeVisible();
  await expect(selection).toHaveAttribute('data-x-mm', ZONE_X_MM);
  await expect(selection).toHaveAttribute('data-z-mm', ZONE_Z_MM);
  await expect(placement.getByTestId('warehouse-rack-preview').locator('li')).toHaveText(CELL_CODES);
  const saveRack = placement.getByTestId('warehouse-rack-submit');
  if (isPhone) {
    await saveRack.tap();
  }
  else {
    await saveRack.click();
  }
  await expect(placement.getByTestId('warehouse-rack-saved')).toBeVisible();

  await navigation.reload();
  await layoutTab.click();
  await expect(setup).toHaveCount(0);
  await expect(zone).toBeVisible();
  const savedRack = grid.getByTestId('warehouse-rack-grid-obstacle');
  await expect(savedRack).toHaveCount(1);
  await expect(savedRack).toHaveAttribute('data-x-mm', ZONE_X_MM);
  await expect(savedRack).toHaveAttribute('data-z-mm', ZONE_Z_MM);

  await addressesTab.click();
  const addressLinks = workspace.getByTestId('warehouse-addresses').locator('a[href^="#/cells/"]');
  await expect(addressLinks).toHaveText(CELL_CODES.map(code => new RegExp(`(?:^|\\s)${code}$`, 'u')));
  const cell = addressLinks.first();
  const cellHash = await cell.getAttribute('href');
  expect(cellHash).toMatch(/^#\/cells\/[\da-f-]{36}$/u);
  await cell.click();
  await expect.poll(() => new URL(page.url()).hash).toBe(cellHash);

  await addressesTab.click();
  const print = await openPrintPreview(workspace.getByTestId('warehouse-print-rack'));
  await expect(print.getPages().locator('h1')).toHaveText(CELL_CODES);
  await print.print();
  await print.close();
  await expect(page.locator('canvas')).toHaveCount(0);
});
