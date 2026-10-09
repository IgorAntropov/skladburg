import type {
  Page,
  Response,
} from '@playwright/test';

import { expect } from '@playwright/test';

import { READ_FONTS_STATE } from '../fixtures/pageScripts.ts';

const FONT_FILE_PATTERN = /\.(?:woff2?|ttf|otf|eot)$/i;

const MANROPE_FONT_PATTERN = /\/manrope-(?:cyrillic|latin)-wght-normal-[\w-]+\.woff2$/;

const MANROPE_FAMILY_PATTERN = /^["']?Manrope["']?(?:,|$)/;

const MAX_FONT_FILES = 2;

export interface FontRobotValue {
  expectManropeApplied: () => Promise<void>;
  expectOnlyManropeWoff2Loaded: () => Promise<void>;
}

interface FontFaceValue {
  family: string;
  status: string;
}

interface FontsStateValue {
  bodyFontFamily: string;
  faces: FontFaceValue[];
  isCyrillicLoaded: boolean;
  isLatinLoaded: boolean;
}

export const createFontRobot = (page: Page): FontRobotValue => {
  const fontUrls: string[] = [];

  page.on('response', (response: Response) => {
    const { pathname } = new URL(response.url());

    if (FONT_FILE_PATTERN.test(pathname) || response.request().resourceType() === 'font') {
      fontUrls.push(response.url());
    }
  });

  return {
    async expectManropeApplied(): Promise<void> {
      await expect.poll(async () => (await page.evaluate<FontsStateValue>(READ_FONTS_STATE)).isLatinLoaded).toBe(true);

      const state = await page.evaluate<FontsStateValue>(READ_FONTS_STATE);
      const manropeFaces = state.faces.filter(face => face.family.replaceAll(/["']/g, '') === 'Manrope');

      expect(state.isLatinLoaded).toBe(true);
      expect(state.isCyrillicLoaded).toBe(true);
      expect(state.bodyFontFamily).toMatch(MANROPE_FAMILY_PATTERN);
      expect(manropeFaces.length).toBeGreaterThan(0);
      expect(manropeFaces.filter(face => face.status === 'loaded').length).toBeGreaterThan(0);
    },
    async expectOnlyManropeWoff2Loaded(): Promise<void> {
      await expect.poll(() => fontUrls.length).toBeGreaterThan(0);

      const urls = [...new Set(fontUrls)];

      expect(urls.length).toBeLessThanOrEqual(MAX_FONT_FILES);
      expect(urls.filter(url => !MANROPE_FONT_PATTERN.test(new URL(url).pathname))).toEqual([]);
    },
  };
};
