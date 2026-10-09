import { test } from '@playwright/test';

import type { ViewportScenarioValue } from './fixtures/viewports.ts';

import { DEFAULT_PERSONA } from './fixtures/demoData.ts';
import {
  LAPTOP_VIEWPORT,
  NARROW_PHONE_VIEWPORT,
  PHONE_VIEWPORT,
  PHONE_VIEWPORT_SCENARIOS,
} from './fixtures/viewports.ts';
import { createEngineGateRobot } from './robots/engine-gate-robot.ts';
import { createHudRobot } from './robots/hud-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createProfileMenuRobot } from './robots/profile-menu-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';

const THEMES = ['light', 'dark'] as const;

const PANEL_VIEWPORTS: readonly ViewportScenarioValue[] = [LAPTOP_VIEWPORT, NARROW_PHONE_VIEWPORT];

const RESET_PENDING_VIEWPORTS: readonly ViewportScenarioValue[] = [LAPTOP_VIEWPORT, PHONE_VIEWPORT];

for (const theme of THEMES) {
  for (const viewport of PANEL_VIEWPORTS) {
    test.describe(`accessibility on ${viewport.name} in the ${theme} theme`, () => {
      test.use({
        hasTouch: viewport.hasTouch,
        isMobile: viewport.isMobile,
        reducedMotion: 'reduce',
        viewport: { height: viewport.height, width: viewport.width },
      });

      test.beforeEach(async ({ page }) => {
        await createHudRobot(page, viewport.layout).preferTheme(theme);
      });

      test('has no violations of WCAG 2.1 A and AA in the panel', async ({ page }) => {
        const hud = createHudRobot(page, viewport.layout);
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.expectDocumentTheme(theme);

        await hud.expectNoViolationsOfAccessibility();
      });

      test('has no violations of WCAG 2.1 A and AA with the profile menu open', async ({ page }) => {
        const hud = createHudRobot(page, viewport.layout);
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.expectDocumentTheme(theme);
        await topBar.openMenu();
        await topBar.expectMenuContent(DEFAULT_PERSONA);

        await hud.expectNoViolationsOfAccessibility();
      });

      test('has no violations of WCAG 2.1 A and AA with the reset question open', async ({ page }) => {
        const hud = createHudRobot(page, viewport.layout);
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.expectDocumentTheme(theme);
        await topBar.requestReset();
        await topBar.expectResetConfirmOpen();
        await topBar.expectResetConfirmFocusedOnCancel();

        await hud.expectNoViolationsOfAccessibility();
      });
    });
  }

  for (const viewport of RESET_PENDING_VIEWPORTS) {
    test.describe(`accessibility of the running reset on ${viewport.name} in the ${theme} theme`, () => {
      test.use({
        hasTouch: viewport.hasTouch,
        isMobile: viewport.isMobile,
        reducedMotion: 'reduce',
        viewport: { height: viewport.height, width: viewport.width },
      });

      test('has no violations of WCAG 2.1 A and AA while the reset runs', async ({ page }) => {
        const gate = createEngineGateRobot(page);
        const hud = createHudRobot(page, viewport.layout);
        const navigation = createNavigationRobot(page);
        const menu = createProfileMenuRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await hud.preferTheme(theme);
        await gate.install();
        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.expectDocumentTheme(theme);
        await topBar.requestReset();
        await topBar.expectResetConfirmOpen();
        await gate.setMode('reset', 'hold');
        await menu.clickAcceptReset();
        await gate.expectHeldCount(1);
        await menu.expectAcceptResetPending();
        await menu.expectProfileButtonResetting();

        await hud.expectNoViolationsOfAccessibility();
      });
    });
  }
}

for (const theme of THEMES) {
  for (const viewport of PHONE_VIEWPORT_SCENARIOS) {
    test.describe(`accessibility of the open search on ${viewport.name} in the ${theme} theme`, () => {
      test.use({
        hasTouch: viewport.hasTouch,
        isMobile: viewport.isMobile,
        reducedMotion: 'reduce',
        viewport: { height: viewport.height, width: viewport.width },
      });

      test('has no violations of WCAG 2.1 A and AA with the search open instead of the panel row', async ({ page }) => {
        const hud = createHudRobot(page, viewport.layout);
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await hud.preferTheme(theme);
        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.expectDocumentTheme(theme);
        await topBar.openSearchWithToggle();
        await topBar.expectPhoneSearchOpen();

        await hud.expectNoViolationsOfAccessibility();
      });
    });
  }
}
