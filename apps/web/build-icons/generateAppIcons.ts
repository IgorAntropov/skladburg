import { chromium } from '@playwright/test';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';

import type { AppIconValue } from './appIcons.ts';

import {
  APP_ICONS,
  ICON_OUTPUT_DIRECTORY,
  ICON_SOURCES_DIRECTORY,
  isVectorIcon,
} from './appIcons.ts';
import { createIconPage } from './createIconPage.ts';

const appRoot = join(import.meta.dirname, '..');

const getSourcePath = ({ source }: AppIconValue): string => join(appRoot, ICON_SOURCES_DIRECTORY, `${source}.svg`);

const getOutputPath = ({ fileName }: AppIconValue): string => join(appRoot, ICON_OUTPUT_DIRECTORY, fileName);

const generateAppIcons = async (): Promise<void> => {
  mkdirSync(join(appRoot, ICON_OUTPUT_DIRECTORY), { recursive: true });

  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ colorScheme: 'light', deviceScaleFactor: 1 });
    const page = await context.newPage();

    for (const icon of APP_ICONS) {
      if (isVectorIcon(icon)) {
        copyFileSync(getSourcePath(icon), getOutputPath(icon));
        continue;
      }

      await page.setViewportSize({ height: icon.size, width: icon.size });
      await page.setContent(createIconPage(readFileSync(getSourcePath(icon), 'utf8'), icon.size));
      await page.screenshot({
        clip: { height: icon.size, width: icon.size, x: 0, y: 0 },
        omitBackground: !icon.hasBackground,
        path: getOutputPath(icon),
      });
    }
  }
  finally {
    await browser.close();
  }

  console.log('> generateAppIcons -> generateAppIcons:', { files: APP_ICONS.map(({ fileName }) => fileName) });
};

await generateAppIcons();
