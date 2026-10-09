import type {
  Page,
  Response,
} from '@playwright/test';

import { expect } from '@playwright/test';

import { MOTION_CODE_MARKERS } from './build-output-robot.ts';

const ENTRY_CHUNK_GLOB = '**/assets/index-*.js';

const ALLOWED_CHUNK_PATTERN = /\/(?:ProfileMenu|motionFeatures)-[^/]+\.js$/;

const PLANTED_MARKER = MOTION_CODE_MARKERS[0];

export interface MotionChunkRobotValue {
  expectMotionCodeLoadedOnlyInMenuChunks: () => Promise<void>;
  expectNoMotionCodeLoaded: () => Promise<void>;
  expectPlantedMotionCodeDetectedOutsideMenuChunks: () => Promise<void>;
  plantMotionCodeInEntryChunk: () => Promise<void>;
  waitForIdle: () => Promise<void>;
}

export const createMotionChunkRobot = (page: Page): MotionChunkRobotValue => {
  const scriptReads: Promise<void>[] = [];
  const motionCodeUrls: string[] = [];

  const readScript = async (response: Response): Promise<void> => {
    const body = await response.text().catch(() => '');

    if (MOTION_CODE_MARKERS.some(marker => body.includes(marker))) {
      motionCodeUrls.push(response.url());
    }
  };

  const readMotionCodeUrls = async (): Promise<string[]> => {
    await Promise.all(scriptReads);

    return [...motionCodeUrls];
  };

  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('.js')) {
      scriptReads.push(readScript(response));
    }
  });

  return {
    async expectMotionCodeLoadedOnlyInMenuChunks(): Promise<void> {
      await expect.poll(async () => {
        const urls = await readMotionCodeUrls();
        const names = urls.map(url => new URL(url).pathname.split('/').pop() ?? '');

        return {
          hasFeatures: names.some(name => name.startsWith('motionFeatures-')),
          hasMenu: names.some(name => name.startsWith('ProfileMenu-')),
          isOnlyAllowed: urls.every(url => ALLOWED_CHUNK_PATTERN.test(new URL(url).pathname)),
        };
      }).toEqual({ hasFeatures: true, hasMenu: true, isOnlyAllowed: true });
    },
    async expectNoMotionCodeLoaded(): Promise<void> {
      await expect.poll(readMotionCodeUrls).toEqual([]);
    },
    async expectPlantedMotionCodeDetectedOutsideMenuChunks(): Promise<void> {
      await expect.poll(async () => {
        const urls = await readMotionCodeUrls();

        return urls.filter(url => !ALLOWED_CHUNK_PATTERN.test(new URL(url).pathname)).length;
      }).toBeGreaterThan(0);
    },
    async plantMotionCodeInEntryChunk(): Promise<void> {
      await page.route(ENTRY_CHUNK_GLOB, async (route) => {
        const response = await route.fetch();
        const body = await response.text();

        await route.fulfill({ body: `${body}\nglobalThis.plantedMotionMarker = "${PLANTED_MARKER}";`, response });
      });
    },
    async waitForIdle(): Promise<void> {
      await page.waitForLoadState('networkidle');
    },
  };
};
