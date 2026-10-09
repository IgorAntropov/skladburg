import { test } from '@playwright/test';

import { DEFAULT_PERSONA } from './fixtures/demoData.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createEngineGateRobot } from './robots/engine-gate-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createProfileMenuRobot } from './robots/profile-menu-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';

test.use({
  hasTouch: DESKTOP_VIEWPORT.hasTouch,
  isMobile: DESKTOP_VIEWPORT.isMobile,
  viewport: { height: DESKTOP_VIEWPORT.height, width: DESKTOP_VIEWPORT.width },
});

test.describe('motion of the panel and the profile menu', () => {
  test('starts no animation and no transition with the reduced motion preference', async ({ page }) => {
    const gate = createEngineGateRobot(page);
    const navigation = createNavigationRobot(page);
    const menu = createProfileMenuRobot(page);
    const topBar = createTopBarRobot(page, 'desktop');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gate.install();
    await navigation.openSection('network');
    await topBar.expectProfileButton(DEFAULT_PERSONA);
    await menu.installAnimationStartRecorder();
    await gate.setMode('list_personas', 'hold');

    await topBar.openMenu();

    await gate.expectHeldCount(1);
    await menu.expectPersonaSkeletonFilled(false);
    await menu.expectNoAnimationsRunning();

    await gate.setMode('list_personas', 'pass');
    await gate.release();
    await menu.expectPersonasListed();
    await topBar.closeMenuWithEscape();
    await topBar.requestReset();

    await topBar.expectResetConfirmOpen();
    await menu.expectPressTransition('0s');
    await menu.expectNoAnimationsRunning();
    await menu.expectNoAnimationStarted();
  });

  test('animates the opening menu and the skeleton and eases the buttons without the reduced motion preference', async ({ page }) => {
    const gate = createEngineGateRobot(page);
    const navigation = createNavigationRobot(page);
    const menu = createProfileMenuRobot(page);
    const topBar = createTopBarRobot(page, 'desktop');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await gate.install();
    await navigation.openSection('network');
    await topBar.expectProfileButton(DEFAULT_PERSONA);
    await menu.installAnimationStartRecorder();
    await gate.setMode('list_personas', 'hold');

    await topBar.openMenu();

    await menu.expectMenuAnimationStarted();
    await gate.expectHeldCount(1);
    await menu.expectPersonaSkeletonFilled(true);

    await gate.setMode('list_personas', 'pass');
    await gate.release();
    await menu.expectPersonasListed();
    await topBar.closeMenuWithEscape();
    await topBar.requestReset();

    await topBar.expectResetConfirmOpen();
    await menu.expectPressTransition(/^0\.1s/);
  });
});
