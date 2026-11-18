import type { Locator } from '@playwright/test';

import { expectNoAxeViolations } from './fixtures/axe.ts';
import { PERSONAS } from './fixtures/demoData.ts';
import { toSectionHash } from './fixtures/routes.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { openPrintPreview } from './robots/print-labels-robot.ts';
import { createProfileMenuLocators } from './robots/profile-menu-locators.ts';
import { CUSTOMER_WAREHOUSE_HASH } from './robots/warehouse-delivery-robot.ts';

const SCENE_SCRIPT = /\/assets\/(?:SceneRoot|WarehouseWorldScene|qualityLevel)-[^/]+\.js$/u;
const GRID_STEP_MM = 100;

const getGridHit = async (
  grid: Locator,
  marker: Locator,
  horizontalOffset = 0,
): Promise<{ x: number; y: number }> => {
  await grid.scrollIntoViewIfNeeded();
  const bounds = await grid.boundingBox();
  const footprint = await marker.boundingBox();
  if (bounds === null || footprint === null) {
    throw new Error('The warehouse grid or footprint is missing');
  }

  return {
    x: footprint.x - bounds.x + footprint.width * (0.5 + horizontalOffset),
    y: footprint.y - bounds.y + footprint.height / 2,
  };
};

test.use({ hasTouch: true, reducedMotion: 'reduce' });

test('places a rack on the grid, restores its position and prints its four addresses', async ({ browserName, page }) => {
  const isDesktop = browserName === 'chromium';
  const colorScheme = isDesktop ? 'light' : 'dark';
  const sceneRequests = new Set<string>();
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (SCENE_SCRIPT.test(pathname)) {
      sceneRequests.add(pathname);
    }
  });
  await page.setViewportSize(isDesktop ? DESKTOP_VIEWPORT : { height: 844, width: 390 });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.emulateMedia({ colorScheme });

  const persona = createPersonaRobot(page);
  const profileMenu = createProfileMenuLocators(page);
  const requestStorekeeperSwitch = async (): Promise<void> => {
    await profileMenu.button.click();
    await expect(profileMenu.menu).toBeVisible();
    await profileMenu.getPersonaItem(PERSONAS.freshStorekeeper).click();
    await expect(profileMenu.menu).toHaveCount(0);
  };
  await persona.openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshCustomer.id);

  const workspace = page.getByTestId('warehouse-workspace');
  const layoutTab = workspace.locator('button[id$="-trigger-layout"]');
  const addressesTab = workspace.locator('button[id$="-trigger-addresses"]');
  await layoutTab.click();

  const placement = workspace.getByTestId('warehouse-rack-placement');
  const previewAddresses = placement.getByTestId('warehouse-rack-preview').locator('li');
  const grid = placement.getByTestId('warehouse-rack-grid');
  const selection = grid.getByTestId('warehouse-rack-grid-selection');
  const obstacles = grid.getByTestId('warehouse-rack-grid-obstacle');
  const positionStatus = placement.getByTestId('warehouse-rack-grid-status');
  const submit = placement.getByTestId('warehouse-rack-submit');
  const leaveConfirm = placement.getByTestId('warehouse-rack-leave');
  await expect(previewAddresses).toHaveCount(4);
  await expect(positionStatus).toBeVisible();
  await expect(positionStatus).not.toHaveAttribute('data-obstacle-kind', /.+/u);
  await expect(selection).toHaveAttribute('data-x-mm', /^\d+$/u);
  const initialX = Number(await selection.getAttribute('data-x-mm'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
  const expectedAddresses = (await previewAddresses.allTextContents()).map(text => text.trim());
  expect(expectedAddresses.every(code => /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/u.test(code))).toBe(true);
  expect(new Set(expectedAddresses).size).toBe(4);
  await expect(page.locator('canvas')).toHaveCount(0);
  if (isDesktop) {
    await expectNoAxeViolations(page);
    await grid.press('ArrowRight');
    const movedX = String(initialX + GRID_STEP_MM);
    await expect(selection).toHaveAttribute('data-x-mm', movedX);
    await requestStorekeeperSwitch();
    await expect(leaveConfirm).toBeVisible();
    await leaveConfirm.getByTestId('warehouse-rack-leave-stay').click();
    await expect(grid).toBeFocused();
    await expect(selection).toHaveAttribute('data-x-mm', movedX);
    await persona.expectCurrentPersona(PERSONAS.freshCustomer);
  }

  const occupiedPosition = await getGridHit(grid, obstacles.first());
  if (isDesktop) {
    await grid.click({ position: occupiedPosition });
  }
  else {
    await grid.tap({ position: occupiedPosition });
  }
  await expect(positionStatus).toHaveAttribute('data-obstacle-kind', /^(?:rack|receiving)$/u);
  await expect(submit).toBeDisabled();

  await workspace.locator(`a[href="${toSectionHash('warehouse')}"]`).click();
  await expect(leaveConfirm).toBeVisible();
  await leaveConfirm.getByTestId('warehouse-rack-leave-stay').click();
  await expect(grid).toBeFocused();
  await expect(positionStatus).toHaveAttribute('data-obstacle-kind', /^(?:rack|receiving)$/u);
  await placement.getByTestId('warehouse-rack-cancel').click();
  await expect(leaveConfirm).toBeVisible();
  await leaveConfirm.getByTestId('warehouse-rack-leave-leave').click();
  await expect(selection).toHaveAttribute('data-x-mm', String(initialX));

  const freePosition = await getGridHit(grid, selection, 1 / 3);
  if (isDesktop) {
    await grid.click({ position: freePosition });
  }
  else {
    await grid.tap({ position: freePosition });
  }
  await expect(selection).not.toHaveAttribute('data-x-mm', String(initialX));
  await expect(positionStatus).not.toHaveAttribute('data-obstacle-kind', /.+/u);
  const savedX = await selection.getAttribute('data-x-mm');
  const savedZ = await selection.getAttribute('data-z-mm');
  if (savedX === null || savedZ === null) {
    throw new Error('The selected rack coordinates are missing');
  }
  await expect(previewAddresses).toHaveText(expectedAddresses);
  await expect(submit).toBeEnabled();
  if (isDesktop) {
    await submit.press('Enter');
  }
  else {
    await submit.tap();
  }
  await expect(placement.getByTestId('warehouse-rack-saved')).toBeVisible();
  const addedRackPrint = await openPrintPreview(placement.getByTestId('warehouse-rack-print'));
  await expect(addedRackPrint.getPages().locator('h1')).toHaveText(expectedAddresses);
  await addedRackPrint.close();

  await page.reload();
  await layoutTab.click();
  const savedFootprint = obstacles.and(page.locator(`[data-x-mm="${savedX}"][data-z-mm="${savedZ}"]`));
  await expect(savedFootprint).toHaveCount(1);
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

  if (isDesktop) {
    await layoutTab.click();
    await grid.press('ArrowRight');
    await requestStorekeeperSwitch();
    await expect(leaveConfirm).toBeVisible();
    await leaveConfirm.getByTestId('warehouse-rack-leave-leave').click();
    await persona.expectCurrentPersona(PERSONAS.freshStorekeeper);
  }
  else {
    await persona.selectPersona(PERSONAS.freshStorekeeper);
  }
  await expect(workspace).toBeVisible();
  await expect(addressesTab).toBeVisible();
  await expect(layoutTab).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect([...sceneRequests]).toEqual([]);
});
