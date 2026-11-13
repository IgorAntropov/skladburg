import { expect } from '@playwright/test';

import { PERSONAS } from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceIfAbsentScript } from './fixtures/graphicsPreference.ts';
import { test } from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { DRAW_COUNTER_INIT_SCRIPT } from './robots/scene-draw-counter.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import {
  CUSTOMER_WAREHOUSE_HASH,
  prepareWarehouseDelivery,
  scanCode,
} from './robots/warehouse-delivery-robot.ts';

test.use({ viewport: DESKTOP_VIEWPORT });

test('renders the dock and the confirmed receiving movements, then returns to rest', async ({ context, page }, testInfo) => {
  test.setTimeout(150_000);
  await context.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript('off') });
  const supplierPage = await context.newPage();
  const storePage = await context.newPage();
  await storePage.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  await storePage.addInitScript({ content: createStoreSystemThemeScript() });
  await storePage.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  const scene = createSceneRobot(storePage);
  scene.watchPageErrors();
  const receiving = storePage.getByTestId('warehouse-receiving-task');
  const canvas = storePage.getByTestId('scene-viewport').locator('canvas');
  let beforeArrival: Buffer = Buffer.alloc(0);
  const { sscc } = await prepareWarehouseDelivery({
    onBeforeArrival: async () => {
      await scene.chooseGraphicsPreference('low');
      await scene.expectSceneState('ready');
      await scene.expectOneCanvas();
      await scene.waitForCameraControls();
      await expect(receiving).toHaveCount(0);
      await scene.waitForIdle();
      beforeArrival = await canvas.screenshot();
    },
    page,
    storePage,
    supplierPage,
  });

  await expect(receiving).toBeVisible();
  await scene.waitForIdle();
  expect((await canvas.screenshot({ path: testInfo.outputPath('dock-day.png') })).equals(beforeArrival)).toBe(false);

  await receiving.getByTestId('warehouse-claim-receiving').click();
  await receiving.getByTestId('warehouse-enter-sscc').click();
  const receive = receiving.getByTestId('warehouse-receive-form');
  await receive.locator('input[name="sscc"]').fill(sscc);
  const beforeReceive = await scene.readDrawFrames();
  await receive.getByTestId('warehouse-receive-submit').click();
  const placement = receiving.getByTestId('warehouse-placement');
  await expect(placement).toBeVisible();
  await scene.waitForDrawFramesToExceed(beforeReceive + 4, 'the dock-to-staging motion did not draw');
  await scene.waitForIdle();

  const placementCell = placement.locator('select');
  const firstCell = placementCell.locator('option').nth(1);
  const cellId = await firstCell.getAttribute('value');
  const beforeScan = await scene.readDrawFrames();
  await scanCode(placement, await firstCell.innerText(), true);
  if (cellId === null) {
    throw new Error('Missing placement cell ID');
  }
  await expect(placementCell).toHaveValue(cellId);
  await expect.poll(() => new URL(storePage.url()).hash).toBe(CUSTOMER_WAREHOUSE_HASH);
  await scene.waitForDrawFramesToExceed(beforeScan, 'scanning a cell did not update the scene');
  await scene.waitForIdle();

  const beforePlacement = await scene.readDrawFrames();
  await placement.getByTestId('warehouse-place-unit').click();
  await expect(placement).toHaveCount(0);
  await scene.waitForDrawFramesToExceed(beforePlacement + 4, 'the staging-to-cell motion did not draw');
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(700);
  await receiving.getByTestId('warehouse-finish-receiving').click();

  const beforeNight = await scene.readDrawFrames();
  await scene.switchColorScheme('dark');
  await scene.expectThemeAttribute('dark');
  await scene.waitForDrawFramesToExceed(beforeNight + 4, 'the night transition did not draw');
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(700);
  await canvas.screenshot({ path: testInfo.outputPath('warehouse-night.png') });
  await scene.tapFreeAreaCenter();
  await expect.poll(() => new URL(storePage.url()).hash).toBe(`#/cells/${cellId}`);

  await createPersonaRobot(storePage).selectPersona(PERSONAS.constructionCustomer);
  await expect(storePage.getByTestId('warehouse-object-unavailable')).toBeVisible();
  await scene.expectNoCanvas();
  expect(scene.readPageErrors()).toEqual([]);
});
