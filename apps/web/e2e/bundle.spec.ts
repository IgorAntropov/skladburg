import { test } from '@playwright/test';

import { DEFAULT_PERSONA } from './fixtures/demoData.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import { createBuildOutputRobot } from './robots/build-output-robot.ts';
import { createMotionChunkRobot } from './robots/motion-chunk-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';

test.use({ viewport: { height: DESKTOP_VIEWPORT.height, width: DESKTOP_VIEWPORT.width } });

test.describe('build output', () => {
  test('keeps the code of motion out of the entry chunk and everything it imports statically', async () => {
    const buildOutput = createBuildOutputRobot();

    await buildOutput.expectEntryChunksFreeOfMotionCode();
  });

  test('keeps the code of motion only in the menu chunk and in the chunk of its animation features', async () => {
    const buildOutput = createBuildOutputRobot();

    await buildOutput.expectMotionCodeOnlyInMenuChunks();
  });

  test('ships only the Cyrillic and Latin woff2 files of Manrope', async () => {
    const buildOutput = createBuildOutputRobot();

    await buildOutput.expectOnlyManropeWoff2();
  });
});

test.describe('code of motion in the loaded chunks', () => {
  test('loads none of it on start and until the profile menu is asked for', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const motionChunk = createMotionChunkRobot(page);
    const topBar = createTopBarRobot(page, 'desktop');

    await navigation.openRoot();
    await topBar.expectProfileButton(DEFAULT_PERSONA);
    await navigation.expectSectionContent('network');
    await motionChunk.waitForIdle();

    await motionChunk.expectNoMotionCodeLoaded();
  });

  test('loads it only in the menu chunk and in the chunk of its animation features once the menu opens', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const motionChunk = createMotionChunkRobot(page);
    const topBar = createTopBarRobot(page, 'desktop');

    await navigation.openRoot();
    await topBar.expectProfileButton(DEFAULT_PERSONA);
    await motionChunk.waitForIdle();
    await motionChunk.expectNoMotionCodeLoaded();

    await topBar.openMenu();
    await topBar.expectMenuContent(DEFAULT_PERSONA);
    await motionChunk.waitForIdle();

    await motionChunk.expectMotionCodeLoadedOnlyInMenuChunks();
  });

  test('reports the code of motion that is planted into the entry chunk', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const motionChunk = createMotionChunkRobot(page);
    const topBar = createTopBarRobot(page, 'desktop');

    await motionChunk.plantMotionCodeInEntryChunk();
    await navigation.openRoot();
    await topBar.expectProfileButton(DEFAULT_PERSONA);
    await motionChunk.waitForIdle();

    await motionChunk.expectPlantedMotionCodeDetectedOutsideMenuChunks();
  });
});
