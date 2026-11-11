import { chromium } from '@playwright/test';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
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
const UNREAD_BADGE = '<circle cx="25" cy="7" r="4.5" fill="#1e2a4a" stroke="#e8e4dc" stroke-width="2"/>';

const getSourcePath = ({ source }: AppIconValue): string => join(appRoot, ICON_SOURCES_DIRECTORY, `${source}.svg`);

const getOutputPath = ({ fileName }: AppIconValue): string => join(appRoot, ICON_OUTPUT_DIRECTORY, fileName);

const generateAppIcons = async (): Promise<void> => {
  mkdirSync(join(appRoot, ICON_OUTPUT_DIRECTORY), { recursive: true });

  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ colorScheme: 'light', deviceScaleFactor: 1 });
    const page = await context.newPage();

    for (const icon of APP_ICONS) {
      const source = readFileSync(getSourcePath(icon), 'utf8');
      const svg = icon.hasUnreadBadge === true ? source.replace('</svg>', `${UNREAD_BADGE}</svg>`) : source;

      if (isVectorIcon(icon)) {
        writeFileSync(getOutputPath(icon), svg);
        continue;
      }

      await page.setViewportSize({ height: icon.size, width: icon.size });
      await page.setContent(createIconPage(svg, icon.size));
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
