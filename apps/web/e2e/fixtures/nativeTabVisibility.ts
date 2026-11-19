import type { BrowserContext } from '@playwright/test';

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect } from './test.ts';

export const withNativeTabVisibility = async (run: (context: BrowserContext) => Promise<void>): Promise<void> => {
  const profile = await mkdtemp(join(tmpdir(), 'warehouse-chromium-'));
  const chrome = spawn(chromium.executablePath(), [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-dev-shm-usage', '--force-color-profile=srgb', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });
  let launchError: Error | undefined;
  chrome.once('error', (error): void => {
    launchError = error;
  });
  const closed = new Promise<void>((resolve) => {
    chrome.once('close', () => {
      resolve();
    });
  });

  try {
    const endpoint = join(profile, 'DevToolsActivePort');
    await expect.poll(async () => {
      if (launchError !== undefined) {
        throw launchError;
      }
      if (chrome.exitCode !== null) {
        throw new Error(`Chromium exited with code ${String(chrome.exitCode)} before opening the DevTools port`);
      }
      return readFile(endpoint, 'utf8').catch(() => '');
    }, { message: 'Chromium must open a DevTools port', timeout: 10_000 }).toMatch(/^\d+\n/u);
    const [port] = (await readFile(endpoint, 'utf8')).split('\n');
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port ?? ''}`, { noDefaults: true });
    try {
      const [context] = browser.contexts();
      if (context === undefined) {
        throw new Error('Chromium did not open its default context');
      }
      await run(context);
    }
    finally {
      await browser.close();
    }
  }
  finally {
    chrome.kill();
    await closed;
    await rm(profile, { force: true, recursive: true });
  }
};
