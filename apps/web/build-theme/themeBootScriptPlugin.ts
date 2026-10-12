import type {
  HtmlTagDescriptor,
  Plugin,
} from 'vite';

import {
  DARK_COLOR_SCHEME_QUERY,
  DEFAULT_THEME_PREFERENCE,
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
  });

  return {
    name: 'skladburg:theme-boot-script',
    transformIndexHtml: {
      handler: () => [{ children: script, injectTo: 'head-prepend', tag: 'script' }],
      order: 'pre',
    },
  };
};
