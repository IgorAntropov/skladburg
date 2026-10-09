import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

const PERSONA_CHUNK_PATTERN = /\/switch-persona-[^/]+\.js$/;

export interface PersonaChunkRobotValue {
  expectRequestCount: (count: number) => Promise<void>;
  waitForIdle: () => Promise<void>;
}

export const createPersonaChunkRobot = (page: Page): PersonaChunkRobotValue => {
  const chunkRequests: string[] = [];

  page.on('request', (request) => {
    if (PERSONA_CHUNK_PATTERN.test(new URL(request.url()).pathname)) {
      chunkRequests.push(request.url());
    }
  });

  return {
    async expectRequestCount(count: number): Promise<void> {
      await expect.poll(() => chunkRequests.length).toBe(count);
    },
    async waitForIdle(): Promise<void> {
      await page.waitForLoadState('networkidle');
    },
  };
};
