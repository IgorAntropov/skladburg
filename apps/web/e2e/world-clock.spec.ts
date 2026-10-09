import { test } from '@playwright/test';

import { VIEWPORT_SCENARIOS } from './fixtures/viewports.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';
import { createWorldClockRobot } from './robots/world-clock-robot.ts';

const MINUTE_MS = 60_000;

const NEAR_SEED_START_MS = 2 * MINUTE_MS;

const BROWSER_TIME_ZONE = 'Asia/Novosibirsk';

const PHONE_WIDTHS = [
  { hasNameShown: false, width: 320 },
  { hasNameShown: true, width: 360 },
];

for (const viewport of VIEWPORT_SCENARIOS) {
  test.describe(`world clock on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      isMobile: viewport.isMobile,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test('shows the group with the time of the world and no scale at the seed scale', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const worldClock = createWorldClockRobot(page);

      await navigation.openRoot();

      await worldClock.expectShown();
      await worldClock.expectNoScale();
    });

    test('keeps the page without a horizontal scroll', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const topBar = createTopBarRobot(page, viewport.layout);
      const worldClock = createWorldClockRobot(page);

      await navigation.openRoot();
      await worldClock.expectShown();

      await topBar.expectNoHorizontalScroll();
    });
  });
}

test.describe('world clock in the time zone of the browser', () => {
  test.use({
    hasTouch: false,
    isMobile: false,
    locale: 'ru-RU',
    timezoneId: BROWSER_TIME_ZONE,
    viewport: { height: 900, width: 1440 },
  });

  test('shows the time that the engine answered, formatted in the zone of the browser', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const worldClock = createWorldClockRobot(page);

    await navigation.openRoot();
    await worldClock.expectShown();

    await worldClock.expectTimeInZone(BROWSER_TIME_ZONE);
    await worldClock.expectTimeNotInUtc(BROWSER_TIME_ZONE);
  });

  test('starts from the seed start of the world at the seed scale', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const worldClock = createWorldClockRobot(page);

    await navigation.openRoot();
    await worldClock.expectShown();

    await worldClock.expectNearSeedStart(NEAR_SEED_START_MS);
  });
});

test.describe('world clock minute change', () => {
  test.use({
    hasTouch: false,
    isMobile: false,
    locale: 'ru-RU',
    timezoneId: BROWSER_TIME_ZONE,
    viewport: { height: 900, width: 1440 },
  });

  test('moves to the next minute once per minute of the page clock', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const worldClock = createWorldClockRobot(page);

    await worldClock.installFakeClock();
    await navigation.openRoot();
    await worldClock.expectShown();
    await worldClock.pauseFakeClock();
    await worldClock.expectTimeInZone(BROWSER_TIME_ZONE);

    const firstMinuteMs = await worldClock.readWorldTimeMs();

    await worldClock.advance(MINUTE_MS);

    await worldClock.expectMinuteAdvancedBy(firstMinuteMs, MINUTE_MS);
    await worldClock.expectTimeInZone(BROWSER_TIME_ZONE);

    await worldClock.advance(MINUTE_MS);

    await worldClock.expectMinuteAdvancedBy(firstMinuteMs, 2 * MINUTE_MS);
    await worldClock.expectTimeInZone(BROWSER_TIME_ZONE);
  });
});

for (const { hasNameShown, width } of PHONE_WIDTHS) {
  test.describe(`world clock on a narrow phone ${String(width)}x740`, () => {
    test.use({
      hasTouch: true,
      isMobile: true,
      viewport: { height: 740, width },
    });

    test('keeps the mark, search button, clock and profile button in one row without a scroll', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const worldClock = createWorldClockRobot(page);

      await navigation.openRoot();
      await worldClock.expectShown();

      await worldClock.expectSingleRowWithoutScroll();
    });

    test(`${hasNameShown ? 'shows' : 'hides'} the product name and keeps the mark`, async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const worldClock = createWorldClockRobot(page);

      await navigation.openRoot();
      await worldClock.expectShown();

      if (hasNameShown) {
        await worldClock.expectProductNameShown();
      }
      else {
        await worldClock.expectProductNameHidden();
      }
    });
  });
}
