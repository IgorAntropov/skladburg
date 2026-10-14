import type {
  BrowserContext,
  Page,
  Response,
} from '@playwright/test';

import { expect } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  createFindMissingPrecachedAssetsScript,
  IS_CONTROLLED_BY_SERVICE_WORKER_SCRIPT,
} from './pwa-scripts.ts';

const PRECACHED_ASSET_PATTERN = /\.(?:css|js|woff2)$/;
const PRECACHE_TIMEOUT_MS = 25_000;
const LICENSES_FILE_PATH = './third-party-licenses.txt';
const LICENSES_FILE_HEADER = 'Licenses of the third-party packages';
const HTTP_OK_STATUS = 200;
const BUILD_ASSETS_DIRECTORY = fileURLToPath(new URL('../../dist/assets', import.meta.url));

export interface PwaRobotValue {
  expectLicensesFileOpenedUnderServiceWorker: () => Promise<void>;
  expectServedFromServiceWorker: (urlPattern: RegExp) => void;
  goOffline: () => Promise<void>;
  reload: () => Promise<void>;
  waitForPrecache: () => Promise<void>;
}

const readBuiltAssetNames = (): readonly string[] => readdirSync(BUILD_ASSETS_DIRECTORY)
  .filter(fileName => PRECACHED_ASSET_PATTERN.test(fileName));

const findMissingPrecachedAssets = async (page: Page, assetNames: readonly string[]): Promise<readonly string[]> => (
  page.evaluate<readonly string[]>(createFindMissingPrecachedAssetsScript(assetNames))
);

export const createPwaRobot = (page: Page, context: BrowserContext): PwaRobotValue => {
  const responses: Response[] = [];

  page.on('response', (response: Response) => {
    responses.push(response);
  });

  return {
    async expectLicensesFileOpenedUnderServiceWorker(): Promise<void> {
      await expect.poll(
        () => page.evaluate<boolean>(IS_CONTROLLED_BY_SERVICE_WORKER_SCRIPT),
      ).toBe(true);

      const response = await page.goto(LICENSES_FILE_PATH);

      expect(response).not.toBeNull();
      expect(response?.status()).toBe(HTTP_OK_STATUS);
      expect(response?.headers()['content-type']).toMatch(/^text\/plain/);
      expect(await response?.text()).toMatch(new RegExp(`^${LICENSES_FILE_HEADER}`));
    },
    expectServedFromServiceWorker(urlPattern: RegExp): void {
      const matched = responses.filter(response => urlPattern.test(new URL(response.url()).pathname));

      expect(matched.length).toBeGreaterThan(0);
      expect(matched.map(response => response.fromServiceWorker())).not.toContain(false);
    },
    async goOffline(): Promise<void> {
      await context.setOffline(true);
    },
    async reload(): Promise<void> {
      responses.length = 0;
      await page.reload();
    },
    async waitForPrecache(): Promise<void> {
      const assetNames = readBuiltAssetNames();

      expect(assetNames.length).toBeGreaterThan(0);

      await expect.poll(
        () => findMissingPrecachedAssets(page, assetNames),
        { timeout: PRECACHE_TIMEOUT_MS },
      ).toEqual([]);
    },
  };
};
