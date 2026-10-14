import {
  existsSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  APP_ICONS,
  ICON_OUTPUT_DIRECTORY,
  ICON_SOURCES_DIRECTORY,
  isManifestIcon,
  isVectorIcon,
} from './appIcons.ts';

const appRoot = join(import.meta.dirname, '..');

const PNG_SIGNATURE = '89504e470d0a1a0a';

const IHDR_WIDTH_OFFSET = 16;

const IHDR_HEIGHT_OFFSET = 20;

const ICON_LINK_PATTERN = /<link\s+rel="(?:apple-touch-icon|icon)"\s+href="([^"]+)"/g;

const readPngSize = (path: string): { height: number; signature: string; width: number } => {
  const bytes = readFileSync(path);

  return {
    height: bytes.readUInt32BE(IHDR_HEIGHT_OFFSET),
    signature: bytes.subarray(0, 8).toString('hex'),
    width: bytes.readUInt32BE(IHDR_WIDTH_OFFSET),
  };
};

describe('APP_ICONS', () => {
  it('lists every file once', () => {
    const fileNames = APP_ICONS.map(({ fileName }) => fileName);

    expect(new Set(fileNames).size).toBe(fileNames.length);
  });

  it.each(APP_ICONS.map(icon => [icon.fileName, icon] as const))('has the master of %s', (_fileName, icon) => {
    expect(existsSync(join(appRoot, ICON_SOURCES_DIRECTORY, `${icon.source}.svg`))).toBe(true);
  });

  it.each(APP_ICONS.map(icon => [icon.fileName, icon] as const))('has the generated file %s', (_fileName, icon) => {
    expect(existsSync(join(appRoot, ICON_OUTPUT_DIRECTORY, icon.fileName))).toBe(true);
  });

  it.each(APP_ICONS.filter(icon => !isVectorIcon(icon)).map(icon => [icon.fileName, icon] as const))(
    'declares the real size of %s',
    (_fileName, icon) => {
      expect(readPngSize(join(appRoot, ICON_OUTPUT_DIRECTORY, icon.fileName))).toEqual({
        height: icon.size,
        signature: PNG_SIGNATURE,
        width: icon.size,
      });
    },
  );

  it('offers the manifest 192 and 512 icons for any purpose and a 512 maskable one', () => {
    const manifestIcons = APP_ICONS.filter(isManifestIcon).map(({ purpose, size }) => ({ purpose, size }));

    expect(manifestIcons).toEqual([
      { purpose: 'any', size: 192 },
      { purpose: 'any', size: 512 },
      { purpose: 'maskable', size: 512 },
    ]);
  });
});

describe('index.html', () => {
  const html = readFileSync(join(appRoot, 'index.html'), 'utf8');
  const hrefs = Array.from(html.matchAll(ICON_LINK_PATTERN), match => match[1] ?? '');

  it('links the favicons and the touch icon', () => {
    expect(hrefs).toEqual(['/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png']);
  });

  it.each(hrefs)('points %s at a generated file', (href) => {
    expect(APP_ICONS.map(({ fileName }) => `/${fileName}`)).toContain(href);
    expect(existsSync(join(appRoot, ICON_OUTPUT_DIRECTORY, href))).toBe(true);
  });
});
