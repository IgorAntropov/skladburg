import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { TempAppRootValue } from './createTempAppRoot.ts';

import { buildProfilePlugin } from './buildProfilePlugin.ts';
import {
  createTempAppRoot,
  createValidProfile,
} from './createTempAppRoot.ts';
import { loadBuildProfile } from './loadBuildProfile.ts';

const cleanups: TempAppRootValue[] = [];

const APP_NAME = 'Тридок';

const createPlugin = (): ReturnType<typeof buildProfilePlugin> => {
  const tempAppRoot = createTempAppRoot({ catalogs: ['ru', 'en'], profiles: { sample: createValidProfile() } });

  cleanups.push(tempAppRoot);

  const profile = loadBuildProfile({ appRoot: tempAppRoot.appRoot, profileName: 'sample' });

  return buildProfilePlugin({ appName: APP_NAME, profile });
};

describe('buildProfilePlugin', () => {
  afterEach(() => {
    for (const tempAppRoot of cleanups.splice(0)) {
      tempAppRoot.remove();
    }
  });

  it('resolves only the virtual module', () => {
    const plugin = createPlugin();

    expect(plugin.resolveId('virtual:build-profile')).toBe('\0virtual:build-profile');
    expect(plugin.resolveId('react')).toBeUndefined();
  });

  it('loads the source of the virtual module', () => {
    const plugin = createPlugin();

    expect(plugin.load('\0virtual:build-profile')).toContain('export const catalogLoaders');
    expect(plugin.load('/src/main.tsx')).toBeUndefined();
  });

  it('substitutes the profile into index.html before other transforms', () => {
    const plugin = createPlugin();

    const html = plugin.transformIndexHtml.handler(
      '<html lang="%PROFILE_LANG%"><title>%PROFILE_TITLE%</title><meta content="%PROFILE_APP_NAME%"></html>',
    );

    expect(plugin.transformIndexHtml.order).toBe('pre');
    expect(html).toBe('<html lang="ru"><title>Северный склад</title><meta content="Тридок"></html>');
  });
});
