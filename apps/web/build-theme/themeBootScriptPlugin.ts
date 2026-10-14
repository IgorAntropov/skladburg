import type {
  HtmlTagDescriptor,
  Plugin,
} from 'vite';

import {
  DARK_COLOR_SCHEME_QUERY,
  DEFAULT_THEME_PREFERENCE,
  THEME_COLOR_BY_THEME,
  THEME_STORAGE_KEY,
} from '../src/shared/theme/themeConstants.ts';
import { createThemeBootScript } from './createThemeBootScript.ts';

export type ThemeBootScriptPluginValue = Omit<Plugin, 'transformIndexHtml'> & {
  transformIndexHtml: { handler: () => HtmlTagDescriptor[]; order: 'pre' };
};

export const themeBootScriptPlugin = (): ThemeBootScriptPluginValue => {
  const script = createThemeBootScript({
    darkQuery: DARK_COLOR_SCHEME_QUERY,
    defaultPreference: DEFAULT_THEME_PREFERENCE,
    storageKey: THEME_STORAGE_KEY,
    themeColors: THEME_COLOR_BY_THEME,
  });

  return {
    name: 'skladburg:theme-boot-script',
    transformIndexHtml: {
      handler: () => [
        { attrs: { content: THEME_COLOR_BY_THEME.light, name: 'theme-color' }, injectTo: 'head-prepend', tag: 'meta' },
        { children: script, injectTo: 'head-prepend', tag: 'script' },
      ],
      order: 'pre',
    },
  };
};
