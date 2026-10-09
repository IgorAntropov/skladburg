import {
  expect,
  test,
} from '@playwright/test';

import { SECTIONS } from './fixtures/routes.ts';
import { VIEWPORT_SCENARIOS } from './fixtures/viewports.ts';
import { createHudRobot } from './robots/hud-robot.ts';
import { createHudSkeletonRobot } from './robots/hud-skeleton-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';

const THEMES = ['light', 'dark'] as const;

const SKELETON_DELAY_MS = 250;

const SKELETON_MIN_VISIBLE_MS = 400;

const TIMING_MARGIN_MS = 50;

const SESSION_URL_PART = 'GetSession';

const LONG_HOLD_MS = 2000;

const SHORT_HOLD_MS = 450;

const AXE_HOLD_MS = 6000;

const TOP_BAR_SHIFT_TOLERANCE_PX = 0.5;

const NEUTRAL_ADDRESSES = [
  { hash: '', name: 'root address' },
  { hash: '#/nope', name: 'unknown address' },
] as const;

const FRAME_TOLERANCE_PX = 0;

const CATALOG_CHUNK_PATTERN = /\/assets\/catalog-[^/]+\.js$/;

for (const viewport of VIEWPORT_SCENARIOS) {
  test.describe(`layout skeleton on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      isMobile: viewport.isMobile,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test('stays invisible until the delay, then shows the frames of the layout and gives way to the page', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const skeleton = createHudSkeletonRobot(page, viewport.layout);

      await skeleton.installRecorder();
      await skeleton.delayRequest(SESSION_URL_PART, LONG_HOLD_MS);
      await navigation.openSection('network');

      await skeleton.expectHiddenAtFirstSight('session');
      await skeleton.expectVisible('session');
      await skeleton.expectVisibleAfterDelay('session', SKELETON_DELAY_MS - TIMING_MARGIN_MS);
      await skeleton.expectFramesOfSection('network');
      await skeleton.expectLabelAnnounced('session');

      await skeleton.expectPageShownAfterSkeleton('session', SKELETON_MIN_VISIBLE_MS);
      await skeleton.expectNoSkeletonInPage();
      await navigation.expectSectionContent('network');
    });

    test('keeps the top bar height and the profile button position while the session loads', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const skeleton = createHudSkeletonRobot(page, viewport.layout);

      await skeleton.delayRequest(SESSION_URL_PART, LONG_HOLD_MS);
      await navigation.openSection('network');
      await skeleton.expectVisible('session');

      const pending = await skeleton.readTopBarGeometry();

      expect(pending.bannerHeight).toBeGreaterThan(0);

      await skeleton.expectNoSkeletonInPage();
      await navigation.expectSectionContent('network');

      const loaded = await skeleton.readTopBarGeometry();

      skeleton.expectSameTopBarGeometry(pending, loaded, TOP_BAR_SHIFT_TOLERANCE_PX);
    });

    test('holds the skeleton for the minimal time when the session answers soon after it appeared', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const skeleton = createHudSkeletonRobot(page, viewport.layout);

      await skeleton.installRecorder();
      await skeleton.delayRequest(SESSION_URL_PART, SHORT_HOLD_MS);
      await navigation.openSection('network');

      await skeleton.expectPageShownAfterSkeleton('session', SKELETON_MIN_VISIBLE_MS - TIMING_MARGIN_MS);
      await skeleton.expectNoSkeletonInPage();
      await navigation.expectSectionContent('network');
    });

    test('never shows the skeleton of the session when the session answers at once', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const skeleton = createHudSkeletonRobot(page, viewport.layout);

      await skeleton.installRecorder();
      await navigation.openSection('network');
      await navigation.expectSectionContent('network');

      await skeleton.expectNeverVisible('session');
    });

    test('shows the skeleton of the section while a slow chunk loads and then the page', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const skeleton = createHudSkeletonRobot(page, viewport.layout);

      await skeleton.delaySectionChunk('network', LONG_HOLD_MS);
      await skeleton.installRecorder();
      await navigation.openSection('network');

      await skeleton.expectHiddenAtFirstSight('section');
      await skeleton.expectVisible('section');
      await skeleton.expectVisibleAfterDelay('section', SKELETON_DELAY_MS - TIMING_MARGIN_MS);
      await skeleton.expectFramesOfSection('network');
      await skeleton.expectLabelAnnounced('section');

      await navigation.expectSectionContent('network');
      await skeleton.expectNoSkeletonInPage();
    });

    test('never shows a skeleton when the next section is already loaded', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const skeleton = createHudSkeletonRobot(page, viewport.layout);

      const catalogChunk = page.waitForResponse(response => CATALOG_CHUNK_PATTERN.test(new URL(response.url()).pathname));

      await skeleton.installRecorder();
      await navigation.openSection('network');
      await navigation.expectSectionContent('network');
      await catalogChunk;
      await skeleton.resetRecorder();

      await navigation.openSectionInPlace('catalog');

      await navigation.expectSectionContent('catalog');
      await skeleton.expectNothingVisibleSinceReset();
    });

    for (const section of SECTIONS) {
      test(`draws the frames of the session skeleton of ${section} exactly where the zones of the page appear`, async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const skeleton = createHudSkeletonRobot(page, viewport.layout);

        await skeleton.delayRequest(SESSION_URL_PART, LONG_HOLD_MS);
        await navigation.openSection(section);
        await skeleton.expectVisible('session');
        await skeleton.expectFramesOfSection(section);

        await skeleton.expectFramesMatchZones(section, FRAME_TOLERANCE_PX);
        await navigation.expectSectionContent(section);
      });

      test(`draws the frames of the chunk skeleton of ${section} exactly where the zones of the page appear`, async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const skeleton = createHudSkeletonRobot(page, viewport.layout);

        await skeleton.delaySectionChunk(section, LONG_HOLD_MS);
        await navigation.openSection(section);
        await skeleton.expectVisible('section');
        await skeleton.expectFramesOfSection(section);

        await skeleton.expectFramesMatchZones(section, FRAME_TOLERANCE_PX);
        await navigation.expectSectionContent(section);
      });
    }

    for (const { hash, name } of NEUTRAL_ADDRESSES) {
      test(`draws no frames, only the announced background, while the session loads at the ${name}`, async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const skeleton = createHudSkeletonRobot(page, viewport.layout);

        await skeleton.delayRequest(SESSION_URL_PART, LONG_HOLD_MS);
        await navigation.openHash(hash);
        await skeleton.expectVisible('session');

        await skeleton.expectNoFrames();
        await skeleton.expectLabelAnnounced('session');
      });
    }

    for (const theme of THEMES) {
      test.describe(`accessibility in the ${theme} theme`, () => {
        test.use({ reducedMotion: 'reduce' });

        for (const section of SECTIONS) {
          test(`has no violations of WCAG 2.1 A and AA while the skeleton of ${section} is visible`, async ({ page }) => {
            const navigation = createNavigationRobot(page);
            const topBar = createTopBarRobot(page, viewport.layout);
            const hud = createHudRobot(page, viewport.layout);
            const skeleton = createHudSkeletonRobot(page, viewport.layout);

            await hud.preferTheme(theme);
            await skeleton.delayRequest(SESSION_URL_PART, AXE_HOLD_MS);
            await navigation.openSection(section);
            await skeleton.expectVisible('session');
            await skeleton.expectFramesOfSection(section);
            await topBar.expectDocumentTheme(theme);

            await hud.expectNoViolationsOfAccessibility();
          });
        }

        test('has no violations of WCAG 2.1 A and AA while the skeleton without a section is visible', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);
          const hud = createHudRobot(page, viewport.layout);
          const skeleton = createHudSkeletonRobot(page, viewport.layout);

          await hud.preferTheme(theme);
          await skeleton.delayRequest(SESSION_URL_PART, AXE_HOLD_MS);
          await navigation.openHash('');
          await skeleton.expectVisible('session');
          await skeleton.expectNoFrames();
          await topBar.expectDocumentTheme(theme);

          await hud.expectNoViolationsOfAccessibility();
        });
      });
    }
  });
}
