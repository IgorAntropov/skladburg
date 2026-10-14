import type {
  Page,
  Route,
} from '@playwright/test';

import { expect } from '@playwright/test';

const FALLBACK_TEST_ID = 'boot-fallback';
const FALLBACK_RELOAD_TEST_ID = 'boot-fallback-reload';
const CHARSET_DECLARATION = '<meta charset="UTF-8"';
const ENCODING_SNIFF_LIMIT_BYTES = 1024;

export const INITIAL_CHUNK_PATTERN = '**/assets/index-*.js';
export const INITIAL_DEPENDENCY_PATTERN = '**/assets/react-*.js';

export interface BootFallbackRobotValue {
  blockAssets: (pattern: string) => Promise<void>;
  expectAbsent: () => Promise<void>;
  expectCharsetWithinEncodingSniffLimit: () => Promise<void>;
  expectShown: () => Promise<void>;
  open: () => Promise<void>;
  reload: () => Promise<void>;
  unblockAssets: (pattern: string) => Promise<void>;
}

const abortRoute = async (route: Route): Promise<void> => {
  await route.abort();
};

export const createBootFallbackRobot = (page: Page): BootFallbackRobotValue => {
  const fallback = page.getByTestId(FALLBACK_TEST_ID);
  const reloadButton = page.getByTestId(FALLBACK_RELOAD_TEST_ID);

  return {
    async blockAssets(pattern: string): Promise<void> {
      await page.route(pattern, abortRoute);
    },
    async expectAbsent(): Promise<void> {
      await expect(fallback).toHaveCount(0);
    },
    async expectCharsetWithinEncodingSniffLimit(): Promise<void> {
      const response = await page.request.get('./');
      const body = await response.body();
      const declarationStart = body.indexOf(CHARSET_DECLARATION);

      expect(declarationStart).toBeGreaterThanOrEqual(0);
      expect(declarationStart + Buffer.byteLength(CHARSET_DECLARATION)).toBeLessThanOrEqual(ENCODING_SNIFF_LIMIT_BYTES);
    },
    async expectShown(): Promise<void> {
      await expect(fallback).toBeVisible();
      await expect(fallback).toHaveAttribute('role', 'alert');
      await expect(reloadButton).toBeVisible();
    },
    async open(): Promise<void> {
      await page.goto('./');
    },
    async reload(): Promise<void> {
      await reloadButton.click();
    },
    async unblockAssets(pattern: string): Promise<void> {
      await page.unroute(pattern, abortRoute);
    },
  };
};
