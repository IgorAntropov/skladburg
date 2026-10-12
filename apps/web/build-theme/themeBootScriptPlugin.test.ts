import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  DARK_COLOR_SCHEME_QUERY,
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
} from '../src/shared/theme/themeConstants.ts';
import { createThemeBootScript } from './createThemeBootScript.ts';
import { themeBootScriptPlugin } from './themeBootScriptPlugin.ts';

describe('themeBootScriptPlugin', () => {
  it('injects one inline script at the very start of the head before other transforms', () => {
    const { transformIndexHtml } = themeBootScriptPlugin();

    expect(transformIndexHtml.order).toBe('pre');
    expect(transformIndexHtml.handler()).toHaveLength(1);
    expect(transformIndexHtml.handler()[0]).toMatchObject({ injectTo: 'head-prepend', tag: 'script' });
  });

  it('builds the script from the constants of the theme store', () => {
    const [tag] = themeBootScriptPlugin().transformIndexHtml.handler();

    expect(tag?.children).toBe(
      createThemeBootScript({
        darkQuery: DARK_COLOR_SCHEME_QUERY,
        defaultPreference: DEFAULT_THEME_PREFERENCE,
        storageKey: THEME_STORAGE_KEY,
      }),
    );
  });
});
