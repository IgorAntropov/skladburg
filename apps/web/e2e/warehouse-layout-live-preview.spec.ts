import type {
  Locator,
  Page,
} from '@playwright/test';

import { PERSONAS } from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { PHONE_VIEWPORT } from './fixtures/viewports.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { CUSTOMER_WAREHOUSE_HASH } from './robots/warehouse-delivery-robot.ts';

interface RackPositionValue {
  xMm: string;
  zMm: string;
}

const GRID_STEP_MM = 100;
const DRAFT_TTL_MS = 120_000;
const TTL_TOLERANCE_MS = 20_000;

const layoutTab = (page: Page): Locator => page.getByTestId('warehouse-workspace').locator('button[id$="-trigger-layout"]');
const addressesTab = (page: Page): Locator => page.getByTestId('warehouse-workspace').locator('button[id$="-trigger-addresses"]');
const rackEditor = (page: Page): Locator => page.getByTestId('warehouse-rack-placement');
const rackObserver = (page: Page): Locator => page.getByTestId('warehouse-layout-observer');
const rackDraft = (page: Page): Locator => rackObserver(page).getByTestId('warehouse-layout-draft');

const moveRack = async (page: Page): Promise<RackPositionValue> => {
  const grid = rackEditor(page).getByTestId('warehouse-rack-grid');
  const selection = grid.getByTestId('warehouse-rack-grid-selection');
  await expect(selection).toHaveAttribute('data-x-mm', /^\d+$/u);
  const zMm = await selection.getAttribute('data-z-mm');
  if (zMm === null) {
    throw new Error('The selected rack has no Z coordinate');
  }

  const xMm = String(Number(await selection.getAttribute('data-x-mm')) + GRID_STEP_MM);
  await grid.press('ArrowRight');
  await expect(selection).toHaveAttribute('data-x-mm', xMm);

  return { xMm, zMm };
};

const expectRackDraft = async (page: Page, position: RackPositionValue): Promise<void> => {
  const draft = rackDraft(page);
  await expect(draft).toHaveCount(1);
  await expect(draft).toHaveAttribute('data-x-mm', position.xMm);
  await expect(draft).toHaveAttribute('data-z-mm', position.zMm);
};

const expectRackAddresses = async (page: Page, codes: readonly string[], count: number): Promise<void> => {
  await addressesTab(page).click();
  const addressList = page.getByTestId('warehouse-addresses');
  await expect(addressList).toBeVisible();
  for (const code of codes) {
    await expect(addressList.locator('a[href^="#/cells/"]').filter({ hasText: new RegExp(`(?:^|\\s)${code}$`, 'u') })).toHaveCount(count);
  }
};

test.use({ reducedMotion: 'reduce' });

test('shares an updated rack draft with a colleague, then removes it on cancel or save', async ({ browserName, context, page }) => {
  test.setTimeout(60_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  await createPersonaRobot(page).openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  await layoutTab(page).click();

  const colleaguePage = await context.newPage();
  try {
    if (browserName === 'webkit') {
      await colleaguePage.setViewportSize(PHONE_VIEWPORT);
    }
    const colleague = createPersonaRobot(colleaguePage);
    await colleague.openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshStorekeeper.id);
    await layoutTab(colleaguePage).click();
    await expect(rackObserver(colleaguePage)).toBeVisible();
    await expect(rackDraft(colleaguePage)).toHaveCount(0);
    await expect(colleaguePage.getByTestId('warehouse-rack-submit')).toHaveCount(0);
    await expect(colleaguePage.locator('canvas')).toHaveCount(0);

    const editor = rackEditor(page);
    const previewAddresses = editor.getByTestId('warehouse-rack-preview').locator('li');
    await expect(previewAddresses).toHaveCount(4);
    const codes = (await previewAddresses.allTextContents()).map(code => code.trim());
    expect(codes.every(code => /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/u.test(code))).toBe(true);
    expect(new Set(codes).size).toBe(4);
    const firstPosition = await moveRack(page);
    await expectRackDraft(colleaguePage, firstPosition);
    const updatedPosition = await moveRack(page);
    await expectRackDraft(colleaguePage, updatedPosition);

    await expectRackAddresses(colleaguePage, codes, 0);
    await colleague.selectPersona(PERSONAS.freshSupplier);
    await expect(colleaguePage.getByTestId('warehouse-object-unavailable')).toBeVisible();
    await expect(rackObserver(colleaguePage)).toHaveCount(0);
    await expect(colleaguePage.getByTestId('warehouse-layout-draft')).toHaveCount(0);
    await colleague.selectPersona(PERSONAS.freshStorekeeper);
    await layoutTab(colleaguePage).click();
    await expectRackDraft(colleaguePage, updatedPosition);

    await editor.getByTestId('warehouse-rack-cancel').click();
    await editor.getByTestId('warehouse-rack-leave-leave').click();
    await expect(rackDraft(colleaguePage)).toHaveCount(0);

    const savedPosition = await moveRack(page);
    await expectRackDraft(colleaguePage, savedPosition);
    const committedRack = rackObserver(colleaguePage).getByTestId('warehouse-rack-grid-obstacle').and(
      colleaguePage.locator(`[data-x-mm="${savedPosition.xMm}"][data-z-mm="${savedPosition.zMm}"]`),
    );
    await expect(committedRack).toHaveCount(0);
    await editor.getByTestId('warehouse-rack-submit').click();
    await expect(editor.getByTestId('warehouse-rack-saved')).toBeVisible();
    await expect(committedRack).toHaveCount(1);
    await expect(rackDraft(colleaguePage)).toHaveCount(0);
    await expectRackAddresses(colleaguePage, codes, 1);
  }
  finally {
    await colleaguePage.close();
  }
});

test('expires the draft and unlocks the zone after the editor tab disappears', async ({ context, page }) => {
  test.setTimeout(DRAFT_TTL_MS + 55_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  await createPersonaRobot(page).openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshCustomer.id);
  await layoutTab(page).click();
  const colleaguePage = await context.newPage();
  try {
    const colleague = createPersonaRobot(colleaguePage);
    await colleague.openAsPersona(CUSTOMER_WAREHOUSE_HASH, PERSONAS.freshStorekeeper.id);
    await layoutTab(colleaguePage).click();
    const position = await moveRack(page);
    await expectRackDraft(colleaguePage, position);
    const closedAt = performance.now();
    await colleaguePage.bringToFront();
    await page.close();
    await colleaguePage.reload();
    await layoutTab(colleaguePage).click();
    await expectRackDraft(colleaguePage, position);

    await expect(rackDraft(colleaguePage)).toHaveCount(0, { timeout: DRAFT_TTL_MS + 15_000 });
    expect(performance.now() - closedAt).toBeGreaterThanOrEqual(DRAFT_TTL_MS - TTL_TOLERANCE_MS);

    await colleague.selectPersona(PERSONAS.freshCustomer);
    await layoutTab(colleaguePage).click();
    await moveRack(colleaguePage);
    await expect(rackEditor(colleaguePage).getByTestId('warehouse-rack-draft-status')).toHaveAttribute('data-state', 'published');
  }
  finally {
    await colleaguePage.close();
  }
});
