import type {
  Page,
  Response,
} from '@playwright/test';

import { expect } from '@playwright/test';

import { getText } from '../fixtures/messages.ts';

const PROFILE_MENU_CHUNK_PATTERN = /\/ProfileMenu-[^/]+\.js$/;

const PROFILE_MENU_CHUNK_GLOB = '**/ProfileMenu-*.js';

const MENU_CODE_MARKERS = ['data-radix-menu-content', 'menuitemradio'];

export interface PersonaChunkRobotValue {
  blockChunk: () => Promise<void>;
  delayChunk: (delayMs: number) => Promise<void>;
  expectLoadError: () => Promise<void>;
  expectMenuCodeOnlyInMenuChunk: () => Promise<void>;
  expectNoLoadError: () => Promise<void>;
  expectNoMenuCodeLoaded: () => Promise<void>;
  expectRequestCount: (count: number) => Promise<void>;
  unblockChunk: () => Promise<void>;
  waitForIdle: () => Promise<void>;
}

export const createPersonaChunkRobot = (page: Page): PersonaChunkRobotValue => {
  const chunkRequests: string[] = [];
  const scriptReads: Promise<void>[] = [];
  const menuCodeUrls: string[] = [];

  const readScript = async (response: Response): Promise<void> => {
    const body = await response.text().catch(() => '');

    if (MENU_CODE_MARKERS.some(marker => body.includes(marker))) {
      menuCodeUrls.push(response.url());
    }
  };

  const readMenuCodeUrls = async (): Promise<string[]> => {
    await Promise.all(scriptReads);

    return [...menuCodeUrls];
  };

  page.on('request', (request) => {
    const { pathname } = new URL(request.url());

    if (PROFILE_MENU_CHUNK_PATTERN.test(pathname)) {
      chunkRequests.push(request.url());
    }
  });

  page.on('response', (response) => {
    const { pathname } = new URL(response.url());

    if (pathname.endsWith('.js')) {
      scriptReads.push(readScript(response));
    }
  });

  const loadErrorNote = page.getByRole('alert').filter({ hasText: getText('routing.chunkError.message') });

  return {
    async blockChunk(): Promise<void> {
      await page.route(PROFILE_MENU_CHUNK_GLOB, route => route.abort());
    },
    async delayChunk(delayMs: number): Promise<void> {
      await page.route(PROFILE_MENU_CHUNK_GLOB, async (route) => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delayMs);
        });
        await route.continue();
      });
    },
    async expectLoadError(): Promise<void> {
      await expect(loadErrorNote).toBeVisible();
    },
    async expectMenuCodeOnlyInMenuChunk(): Promise<void> {
      await expect.poll(async () => {
        const urls = await readMenuCodeUrls();

        return urls.length > 0 && urls.every(url => PROFILE_MENU_CHUNK_PATTERN.test(new URL(url).pathname));
      }).toBe(true);
    },
    async expectNoLoadError(): Promise<void> {
      await expect(loadErrorNote).toHaveCount(0);
    },
    async expectNoMenuCodeLoaded(): Promise<void> {
      await expect.poll(readMenuCodeUrls).toEqual([]);
    },
    async expectRequestCount(count: number): Promise<void> {
      await expect.poll(() => chunkRequests.length).toBe(count);
    },
    async unblockChunk(): Promise<void> {
      await page.unroute(PROFILE_MENU_CHUNK_GLOB);
    },
    async waitForIdle(): Promise<void> {
      await page.waitForLoadState('networkidle');
    },
  };
};
