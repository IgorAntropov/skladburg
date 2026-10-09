import {
  expect,
  test,
} from '@playwright/test';

import { VEHICLE_ROUTE } from './fixtures/routes.ts';
import {
  DESKTOP_VIEWPORT,
  LAPTOP_VIEWPORT,
} from './fixtures/viewports.ts';
import { createHudRobot } from './robots/hud-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';

const DESKTOP_SCENARIOS = [DESKTOP_VIEWPORT, LAPTOP_VIEWPORT] as const;

const SAME_HEIGHT_TOLERANCE_PX = 1;

for (const viewport of DESKTOP_SCENARIOS) {
  test.describe(`zones of the network on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      isMobile: viewport.isMobile,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test('keeps the indicators, the tracker, the inspector and the lists apart inside the window', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const hud = createHudRobot(page, viewport.layout);

      await navigation.openSection('network');

      await hud.expectNetworkZonesOnDesktop();
      await hud.expectZonesApartInsideWindow();
      await hud.expectNoVerticalScroll();
      await hud.expectNoHorizontalScroll();
    });

    test('gives the indicators and the tracker the same height', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const hud = createHudRobot(page, viewport.layout);

      await navigation.openSection('network');
      await hud.expectNetworkZonesOnDesktop();

      await hud.expectKpiAndTrackerOfSameHeight();
    });

    test('keeps the zones apart when an object is open in the inspector', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const hud = createHudRobot(page, viewport.layout);

      await navigation.openSection('network');
      await hud.expectInspectorEmpty();
      await hud.openObjectInPlace(VEHICLE_ROUTE);
      await hud.expectInspectorOpen(VEHICLE_ROUTE);

      await hud.expectZonesApartInsideWindow();
      await hud.expectNoVerticalScroll();
    });
  });
}

test.describe('empty inspector across desktop sizes', () => {
  test.use({
    hasTouch: DESKTOP_VIEWPORT.hasTouch,
    isMobile: DESKTOP_VIEWPORT.isMobile,
    viewport: { height: DESKTOP_VIEWPORT.height, width: DESKTOP_VIEWPORT.width },
  });

  test('keeps the height of the empty inspector on 1440x900 and 1280x800', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const hud = createHudRobot(page, DESKTOP_VIEWPORT.layout);

    await navigation.openSection('network');
    await hud.expectInspectorEmpty();

    const wideHeight = await hud.readInspectorHeight();

    await page.setViewportSize({ height: LAPTOP_VIEWPORT.height, width: LAPTOP_VIEWPORT.width });
    await hud.expectInspectorEmpty();

    await expect.poll(() => hud.readInspectorHeight().then(height => Math.abs(height - wideHeight)))
      .toBeLessThanOrEqual(SAME_HEIGHT_TOLERANCE_PX);
  });
});
