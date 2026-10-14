import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  DARK_COLOR_SCHEME_QUERY,
  DEFAULT_THEME_PREFERENCE,
  THEME_COLOR_BY_THEME,
  THEME_STORAGE_KEY,
} from '../src/shared/theme/themeConstants.ts';
import { createThemeBootScript } from './createThemeBootScript.ts';
import { themeBootScriptPlugin } from './themeBootScriptPlugin.ts';

describe('themeBootScriptPlugin', () => {
  it('injects the theme-color meta and one inline script at the start of the head before other transforms', () => {
    const { transformIndexHtml } = themeBootScriptPlugin();

    expect(transformIndexHtml.order).toBe('pre');
    expect(transformIndexHtml.handler()).toHaveLength(2);
    expect(transformIndexHtml.handler()[0]).toMatchObject({ injectTo: 'head-prepend', tag: 'meta' });
    expect(transformIndexHtml.handler()[1]).toMatchObject({ injectTo: 'head-prepend', tag: 'script' });
  });

  it('puts the light theme color into the meta so the page has a color before any script runs', () => {
    const [tag] = themeBootScriptPlugin().transformIndexHtml.handler();

    expect(tag?.attrs).toEqual({ content: THEME_COLOR_BY_THEME.light, name: 'theme-color' });
  });

  it('builds the script from the constants of the theme store', () => {
    const [, tag] = themeBootScriptPlugin().transformIndexHtml.handler();

    expect(tag?.children).toBe(
      createThemeBootScript({
        darkQuery: DARK_COLOR_SCHEME_QUERY,
        defaultPreference: DEFAULT_THEME_PREFERENCE,
        storageKey: THEME_STORAGE_KEY,
        themeColors: THEME_COLOR_BY_THEME,
      }),
    );
  });
});
