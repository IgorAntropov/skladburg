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

const cleanups: TempAppRootValue[] = [];

const prepare = (...args: Parameters<typeof createTempAppRoot>): string => {
  const tempAppRoot = createTempAppRoot(...args);

  cleanups.push(tempAppRoot);

  return tempAppRoot.appRoot;
};

describe('buildProfilePlugin', () => {
  afterEach(() => {
    for (const tempAppRoot of cleanups.splice(0)) {
      tempAppRoot.remove();
    }
  });

  it('resolves only the virtual module', () => {
    const appRoot = prepare({ catalogs: ['ru', 'en'], profiles: { sample: createValidProfile() } });
    const plugin = buildProfilePlugin({ appRoot, profileName: 'sample' });

    expect(plugin.resolveId('virtual:build-profile')).toBe('\0virtual:build-profile');
    expect(plugin.resolveId('react')).toBeUndefined();
  });

  it('loads the source of the virtual module', () => {
    const appRoot = prepare({ catalogs: ['ru', 'en'], profiles: { sample: createValidProfile() } });
    const plugin = buildProfilePlugin({ appRoot, profileName: 'sample' });

    expect(plugin.load('\0virtual:build-profile')).toContain('export const catalogLoaders');
    expect(plugin.load('/src/main.tsx')).toBeUndefined();
  });

  it('substitutes the profile into index.html before other transforms', () => {
    const appRoot = prepare({ catalogs: ['ru', 'en'], profiles: { sample: createValidProfile() } });
    const plugin = buildProfilePlugin({ appRoot, profileName: 'sample' });

    const html = plugin.transformIndexHtml.handler('<html lang="%PROFILE_LANG%"><title>%PROFILE_TITLE%</title></html>');

    expect(plugin.transformIndexHtml.order).toBe('pre');
    expect(html).toBe('<html lang="ru"><title>Северный склад</title></html>');
  });

  it('fails fast when the profile is invalid', () => {
    const appRoot = prepare();

    expect(() => buildProfilePlugin({ appRoot, profileName: 'missing' })).toThrow(/not found/);
  });
});
