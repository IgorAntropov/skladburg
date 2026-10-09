import { expect } from '@playwright/test';
import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { basename } from 'node:path';

export const MOTION_CODE_MARKERS = ['framerAppearId', 'dragConstraints', 'animateVisualElement'] as const;

const DIST_DIRECTORY = new URL('../../dist/', import.meta.url);

const ASSETS_DIRECTORY = new URL('assets/', DIST_DIRECTORY);

const ENTRY_REFERENCE_PATTERN = /(?:src|href)="([^"]+\.js)"/g;

const STATIC_IMPORT_PATTERN = /(?:\bfrom|\bimport)\s*["'`]\.\/([^"'`]+\.js)["'`]/g;

const FONT_FILE_PATTERN = /\.(?:woff2?|ttf|otf|eot)$/i;

const MENU_CHUNK_PATTERN = /^ProfileMenu-[\w-]+\.js$/;

const MOTION_FEATURES_CHUNK_PATTERN = /^motionFeatures-[\w-]+\.js$/;

const MANROPE_FONT_PATTERN = /^manrope-(?:cyrillic|latin)-wght-normal-[\w-]+\.woff2$/;

export interface BuildOutputRobotValue {
  expectEntryChunksFreeOfMotionCode: () => Promise<void>;
  expectMotionCodeOnlyInMenuChunks: () => Promise<void>;
  expectOnlyManropeWoff2: () => Promise<void>;
}

const readChunk = (name: string): Promise<string> => readFile(new URL(name, ASSETS_DIRECTORY), 'utf8');

const hasMotionCode = (source: string): boolean => MOTION_CODE_MARKERS.some(marker => source.includes(marker));

const listAssetNames = (): Promise<string[]> => readdir(ASSETS_DIRECTORY);

const listChunkNames = async (): Promise<string[]> => (await listAssetNames()).filter(name => name.endsWith('.js'));

const readEntryChunkNames = async (): Promise<string[]> => {
  const indexHtml = await readFile(new URL('index.html', DIST_DIRECTORY), 'utf8');
  const queue = [...indexHtml.matchAll(ENTRY_REFERENCE_PATTERN)].map(match => basename(match[1] ?? ''));
  const visited = new Set<string>();

  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    if (visited.has(name)) {
      continue;
    }

    visited.add(name);

    const source = await readChunk(name);

    for (const match of source.matchAll(STATIC_IMPORT_PATTERN)) {
      queue.push(basename(match[1] ?? ''));
    }
  }

  return [...visited];
};

export const createBuildOutputRobot = (): BuildOutputRobotValue => ({
  async expectEntryChunksFreeOfMotionCode(): Promise<void> {
    const entryNames = await readEntryChunkNames();

    expect(entryNames.length, 'the entry chunk and its static imports are found').toBeGreaterThan(1);

    const infected: string[] = [];

    for (const name of entryNames) {
      if (hasMotionCode(await readChunk(name))) {
        infected.push(name);
      }
    }

    expect(infected).toEqual([]);
  },
  async expectMotionCodeOnlyInMenuChunks(): Promise<void> {
    const holders: string[] = [];

    for (const name of await listChunkNames()) {
      if (hasMotionCode(await readChunk(name))) {
        holders.push(name);
      }
    }

    expect(holders.filter(name => MENU_CHUNK_PATTERN.test(name)), 'the menu chunk carries the core of motion').toHaveLength(1);
    expect(holders.filter(name => MOTION_FEATURES_CHUNK_PATTERN.test(name)), 'the features chunk carries the animations').toHaveLength(1);
    expect(holders.filter(name => !MENU_CHUNK_PATTERN.test(name) && !MOTION_FEATURES_CHUNK_PATTERN.test(name))).toEqual([]);
  },
  async expectOnlyManropeWoff2(): Promise<void> {
    const fontNames = (await listAssetNames()).filter(name => FONT_FILE_PATTERN.test(name));

    expect(fontNames.length).toBeGreaterThan(0);
    expect(fontNames.length).toBeLessThanOrEqual(2);
    expect(fontNames.filter(name => !MANROPE_FONT_PATTERN.test(name))).toEqual([]);
  },
});
