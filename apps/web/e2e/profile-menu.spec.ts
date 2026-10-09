import { test } from '@playwright/test';

import { DEFAULT_PERSONA } from './fixtures/demoData.ts';
import {
  DESKTOP_VIEWPORT,
  MENU_VIEWPORT_SCENARIOS,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import { createEngineGateRobot } from './robots/engine-gate-robot.ts';
import { createHudRobot } from './robots/hud-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createProfileMenuRobot } from './robots/profile-menu-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';

const THEMES = ['light', 'dark'] as const;

const RETRY_LOAD_TIMEOUT_MS = 60_000;

for (const viewport of MENU_VIEWPORT_SCENARIOS) {
  const isPhone = viewport.layout === 'phone';

  for (const theme of THEMES) {
    test.describe(`profile menu geometry on ${viewport.name} in the ${theme} theme`, () => {
      test.use({
        hasTouch: viewport.hasTouch,
        isMobile: viewport.isMobile,
        viewport: { height: viewport.height, width: viewport.width },
      });

      test.beforeEach(async ({ page }) => {
        await createHudRobot(page, viewport.layout).preferTheme(theme);
      });

      if (isPhone) {
        test('scrolls only the persona block and keeps the footer and the reset item whole in the window', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const menu = createProfileMenuRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectProfileButton(DEFAULT_PERSONA);

          await topBar.openMenu();
          await topBar.expectDocumentTheme(theme);

          await menu.expectOnlyPersonaBlockScrollable();
          await menu.expectFooterShown();
        });

        test('reaches the reset item with the End key and scrolls the last persona into the block on focus', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const menu = createProfileMenuRobot(page);
          const persona = createPersonaRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectProfileButton(DEFAULT_PERSONA);
          await persona.openMenuWithEnter();
          await menu.settleAnimations();

          await menu.focusResetWithEnd();
          await menu.expectOnlyPersonaBlockScrollable();

          await menu.expectLastPersonaScrolledIntoView();
          await menu.expectFooterShown();
        });
      }
      else {
        test('shows the reset item whole without a scroll of the menu', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const menu = createProfileMenuRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectProfileButton(DEFAULT_PERSONA);

          await topBar.openMenu();
          await topBar.expectDocumentTheme(theme);

          await menu.expectResetItemShownWholeWithoutScroll();
          await menu.expectFooterShown();
        });

        test('keeps the reset item whole after the End key moved the focus to it', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const menu = createProfileMenuRobot(page);
          const persona = createPersonaRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectProfileButton(DEFAULT_PERSONA);
          await persona.openMenuWithEnter();
          await menu.settleAnimations();

          await menu.focusResetWithEnd();

          await menu.expectResetItemShownWholeWithoutScroll();
        });
      }
    });
  }
}

for (const viewport of [DESKTOP_VIEWPORT, PHONE_VIEWPORT]) {
  test.describe(`demo reset in progress on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      isMobile: viewport.isMobile,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test('stays busy without opening the menu, keeps the accept button width and opens the menu after the reset', async ({ page }) => {
      const gate = createEngineGateRobot(page);
      const navigation = createNavigationRobot(page);
      const menu = createProfileMenuRobot(page);
      const topBar = createTopBarRobot(page, viewport.layout);

      await gate.install();
      await navigation.openSection('network');
      await topBar.expectProfileButton(DEFAULT_PERSONA);
      await topBar.requestReset();
      await topBar.expectResetConfirmOpen();
      const acceptWidthBefore = await menu.readAcceptWidth();
      await gate.setMode('reset', 'hold');

      await menu.clickAcceptReset();

      await gate.expectHeldCount(1);
      await menu.expectAcceptResetPending();
      await menu.expectAcceptWidthKept(acceptWidthBefore);
      await menu.expectProfileButtonResetting();
      await menu.clickProfileButtonWhileResetting();
      await menu.expectProfileButtonResetting();

      await gate.setMode('reset', 'pass');
      await gate.release();

      await topBar.expectResetConfirmClosed();
      await topBar.expectResetAnnounced();
      await topBar.expectFocusOnProfileButton();
      await menu.expectProfileButtonReady(DEFAULT_PERSONA);

      await topBar.openMenu();
      await topBar.expectMenuContent(DEFAULT_PERSONA);
    });
  });
}

test.describe('persona list that did not load', () => {
  test.use({
    hasTouch: DESKTOP_VIEWPORT.hasTouch,
    isMobile: DESKTOP_VIEWPORT.isMobile,
    viewport: { height: DESKTOP_VIEWPORT.height, width: DESKTOP_VIEWPORT.width },
  });

  test('keeps the menu open on the retry item, shows the personas after it and keeps the focus inside the menu', async ({ page }) => {
    test.setTimeout(RETRY_LOAD_TIMEOUT_MS);

    const gate = createEngineGateRobot(page);
    const navigation = createNavigationRobot(page);
    const menu = createProfileMenuRobot(page);
    const topBar = createTopBarRobot(page, 'desktop');

    await gate.install();
    await navigation.openSection('network');
    await topBar.expectProfileButton(DEFAULT_PERSONA);
    await gate.setMode('list_personas', 'fail');
    await topBar.openMenu();
    await menu.expectPersonaLoadError();
    await gate.setMode('list_personas', 'pass');

    await menu.clickRetryPersonas();

    await topBar.expectMenuOpen();
    await menu.expectPersonasListed();
    await menu.expectRetryItemAbsent();
    await menu.expectFocusInsideMenu();
    await topBar.expectMenuContent(DEFAULT_PERSONA);
  });
});
