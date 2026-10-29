import {
  describe,
  expect,
  it,
} from 'vitest';

import { appVersionPlugin } from './appVersionPlugin.ts';

describe('appVersionPlugin', () => {
  it('resolves only the virtual module', () => {
    const plugin = appVersionPlugin({ appVersion: 'dev' });

    expect(plugin.resolveId('virtual:app-version')).toBe('\0virtual:app-version');
    expect(plugin.resolveId('virtual:build-profile')).toBeUndefined();
  });

  it('loads the version as a string export', () => {
    const plugin = appVersionPlugin({ appVersion: 'a1b2c3d' });

    expect(plugin.load('\0virtual:app-version')).toBe('export const appVersion = "a1b2c3d";\n');
    expect(plugin.load('/src/main.tsx')).toBeUndefined();
  });
});
