import { test } from '@playwright/test';

import { DEFAULT_PERSONA } from './fixtures/demoData.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createFontRobot } from './robots/font-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';

test.use({ viewport: { height: DESKTOP_VIEWPORT.height, width: DESKTOP_VIEWPORT.width } });

test.describe('font of the product', () => {
  test('applies Manrope to the page once the fonts are ready', async ({ page }) => {
    const fonts = createFontRobot(page);
    const navigation = createNavigationRobot(page);
    const topBar = createTopBarRobot(page, 'desktop');

    await navigation.openRoot();
    await topBar.expectProfileButton(DEFAULT_PERSONA);

    await fonts.expectManropeApplied();
  });

  test('loads nothing but the woff2 files of Manrope and at most two of them', async ({ page }) => {
    const fonts = createFontRobot(page);
    const navigation = createNavigationRobot(page);
    const topBar = createTopBarRobot(page, 'desktop');

    await navigation.openRoot();
    await topBar.expectProfileButton(DEFAULT_PERSONA);

    await fonts.expectOnlyManropeWoff2Loaded();
  });
});
