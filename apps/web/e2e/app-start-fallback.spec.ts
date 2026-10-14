import { DEFAULT_PERSONA } from './fixtures/demoData.ts';
import { FIRST_SECTION } from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import {
  createBootFallbackRobot,
  INITIAL_CHUNK_PATTERN,
  INITIAL_DEPENDENCY_PATTERN,
} from './robots/boot-fallback-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

test.describe('app start fallback', () => {
  test('shows the fallback when the initial chunk is lost and starts the app after a reload', async ({ page }) => {
    const bootFallback = createBootFallbackRobot(page);
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);

    await bootFallback.blockAssets(INITIAL_CHUNK_PATTERN);
    await bootFallback.open();

    await bootFallback.expectShown();

    await bootFallback.unblockAssets(INITIAL_CHUNK_PATTERN);
    await bootFallback.reload();

    await navigation.expectSection(FIRST_SECTION);
    await persona.expectCurrentPersona(DEFAULT_PERSONA);
    await bootFallback.expectAbsent();
  });

  test('shows the fallback when a static dependency of the initial chunk is lost', async ({ page }) => {
    const bootFallback = createBootFallbackRobot(page);

    await bootFallback.blockAssets(INITIAL_DEPENDENCY_PATTERN);
    await bootFallback.open();

    await bootFallback.expectShown();
  });

  test('declares the encoding within the first kilobyte of the served page', async ({ page }) => {
    const bootFallback = createBootFallbackRobot(page);

    await bootFallback.expectCharsetWithinEncodingSniffLimit();
  });

  test('does not show the fallback on a normal start', async ({ page }) => {
    const bootFallback = createBootFallbackRobot(page);
    const navigation = createNavigationRobot(page);

    await bootFallback.open();

    await navigation.expectSection(FIRST_SECTION);
    await bootFallback.expectAbsent();
  });
});
