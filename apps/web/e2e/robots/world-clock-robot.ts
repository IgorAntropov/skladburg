import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import { SEED_WORLD_START_MS } from '../fixtures/demoData.ts';
import { getText } from '../fixtures/messages.ts';
import {
  createReadWorldClockScript,
  READ_HORIZONTAL_OVERFLOW,
  READ_PAGE_CLOCK_NOW,
} from '../fixtures/pageScripts.ts';
import { createProfileMenuLocators } from './profile-menu-locators.ts';

const CLOCK_TEST_ID = 'top-bar-clock-slot';

const TIME_TEXT_PATTERN = /^\d{2}:\d{2}$/;

const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const PAUSE_OFFSET_MS = 2000;

const SAME_ROW_TOLERANCE_PX = 4;

const HIDDEN_NAME_MAX_SIZE_PX = 2;

export interface WorldClockRobotValue {
  advance: (durationMs: number) => Promise<void>;
  expectMinuteAdvancedBy: (previousMs: number, stepMs: number) => Promise<void>;
  expectNearSeedStart: (maxElapsedMs: number) => Promise<void>;
  expectNoScale: () => Promise<void>;
  expectProductNameHidden: () => Promise<void>;
  expectProductNameShown: () => Promise<void>;
  expectShown: () => Promise<void>;
  expectSingleRowWithoutScroll: () => Promise<void>;
  expectTimeInZone: (timeZone: string) => Promise<void>;
  expectTimeNotInUtc: (timeZone: string) => Promise<void>;
  installFakeClock: () => Promise<void>;
  pauseFakeClock: () => Promise<void>;
  readWorldTimeMs: () => Promise<number>;
}

interface BoxValue {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface WorldClockReadingValue {
  dateTime: string;
  expected: string;
  expectedUtc: string;
  text: string;
}

export const createWorldClockRobot = (page: Page): WorldClockRobotValue => {
  const { banner, button: profileButton } = createProfileMenuLocators(page);
  const clock = page.getByTestId(CLOCK_TEST_ID);
  const time = clock.locator('time');
  const productMark = page.getByTestId('product-mark');
  const productName = banner.getByText(getText('app.productName'), { exact: true });
  const searchToggle = banner.getByRole('button', { name: getText('search.open') });
  const scaleSign = getText('clock.scale').replace('{scale}', '');
  const scaleLabelPrefix = getText('clock.scale.label').replace('{scale}', '');

  const readClock = (timeZone: string): Promise<null | WorldClockReadingValue> => page.evaluate<null | WorldClockReadingValue>(
    createReadWorldClockScript(CLOCK_TEST_ID, timeZone),
  );

  const readBox = async (description: string, locator: Locator): Promise<BoxValue> => {
    await expect(locator, description).toBeVisible();

    const box = await locator.boundingBox();

    expect(box, description).not.toBeNull();

    return box ?? { height: 0, width: 0, x: 0, y: 0 };
  };

  const getCenterY = ({ height, y }: BoxValue): number => y + height / 2;

  const readWorldTimeMs = async (): Promise<number> => {
    await expect(time).toHaveAttribute('datetime', ISO_UTC_PATTERN);

    const dateTime = await time.getAttribute('datetime');

    return Date.parse(dateTime ?? '');
  };

  return {
    async advance(durationMs: number): Promise<void> {
      await page.clock.runFor(durationMs);
    },
    async expectMinuteAdvancedBy(previousMs: number, stepMs: number): Promise<void> {
      await expect.poll(readWorldTimeMs).toBe(previousMs + stepMs);
    },
    async expectNearSeedStart(maxElapsedMs: number): Promise<void> {
      const worldTimeMs = await readWorldTimeMs();

      expect(worldTimeMs).toBeGreaterThanOrEqual(SEED_WORLD_START_MS);
      expect(worldTimeMs - SEED_WORLD_START_MS).toBeLessThanOrEqual(maxElapsedMs);
    },
    async expectNoScale(): Promise<void> {
      await expect(clock).toHaveText(TIME_TEXT_PATTERN);
      await expect(clock).not.toContainText(scaleSign);
      await expect(clock).not.toContainText(scaleLabelPrefix);
    },
    async expectProductNameHidden(): Promise<void> {
      await expect(productMark).toBeVisible();

      const box = await productName.boundingBox();

      expect(box?.width ?? 0).toBeLessThanOrEqual(HIDDEN_NAME_MAX_SIZE_PX);
      expect(box?.height ?? 0).toBeLessThanOrEqual(HIDDEN_NAME_MAX_SIZE_PX);
    },
    async expectProductNameShown(): Promise<void> {
      await expect(productMark).toBeVisible();

      const box = await readBox('product name', productName);

      expect(box.width).toBeGreaterThan(HIDDEN_NAME_MAX_SIZE_PX);
      expect(box.height).toBeGreaterThan(HIDDEN_NAME_MAX_SIZE_PX);
    },
    async expectShown(): Promise<void> {
      await expect(banner.getByRole('group', { name: getText('clock.label') })).toBeVisible();
      await expect(clock).toBeVisible();
      await expect(clock).toHaveAttribute('role', 'group');
      await expect(clock).toHaveAttribute('aria-label', getText('clock.label'));
      await expect(time).toBeVisible();
      await expect(time).toHaveText(TIME_TEXT_PATTERN);
      await expect(time).toHaveAttribute('datetime', ISO_UTC_PATTERN);
    },
    async expectSingleRowWithoutScroll(): Promise<void> {
      await expect(clock).toBeVisible();

      const mark = await readBox('product mark', productMark);
      const toggle = await readBox('search toggle', searchToggle);
      const clockBox = await readBox('clock', clock);
      const profile = await readBox('profile button', profileButton);
      const bannerBox = await readBox('banner', banner);
      const ordered = [mark, toggle, clockBox, profile];

      for (const box of ordered) {
        expect(Math.abs(getCenterY(box) - getCenterY(profile))).toBeLessThanOrEqual(SAME_ROW_TOLERANCE_PX);
        expect(box.y).toBeGreaterThanOrEqual(bannerBox.y);
        expect(box.y + box.height).toBeLessThanOrEqual(bannerBox.y + bannerBox.height);
      }

      for (let index = 1; index < ordered.length; index += 1) {
        const left = ordered[index - 1];
        const right = ordered[index];

        expect(left).toBeDefined();
        expect(right).toBeDefined();
        expect((left?.x ?? 0) + (left?.width ?? 0)).toBeLessThanOrEqual((right?.x ?? 0) + 0.5);
      }

      expect(profile.x + profile.width).toBeLessThanOrEqual(bannerBox.x + bannerBox.width);
      await expect.poll(() => page.evaluate<number>(READ_HORIZONTAL_OVERFLOW)).toBeLessThanOrEqual(0);
    },
    async expectTimeInZone(timeZone: string): Promise<void> {
      await expect.poll(async () => {
        const reading = await readClock(timeZone);

        return reading !== null && TIME_TEXT_PATTERN.test(reading.text) && reading.text === reading.expected;
      }).toBe(true);
    },
    async expectTimeNotInUtc(timeZone: string): Promise<void> {
      const reading = await readClock(timeZone);

      expect(reading).not.toBeNull();
      expect(reading?.text).not.toBe(reading?.expectedUtc);
    },
    async installFakeClock(): Promise<void> {
      await page.clock.install({ time: new Date() });
    },
    async pauseFakeClock(): Promise<void> {
      const pageNowMs = await page.evaluate<number>(READ_PAGE_CLOCK_NOW);

      await page.clock.pauseAt(pageNowMs + PAUSE_OFFSET_MS);
    },
    readWorldTimeMs,
  };
};
