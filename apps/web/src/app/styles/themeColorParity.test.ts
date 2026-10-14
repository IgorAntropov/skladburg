import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  MANIFEST_BACKGROUND_COLOR,
  THEME_COLOR_BY_THEME,
} from '@/shared/theme';

import { readThemeTokens } from './testing/readThemeTokens';
import themeCss from './theme.css?raw';

const { tokens } = readThemeTokens(themeCss);

describe('theme colors outside the stylesheet', () => {
  it.each(['light', 'dark'] as const)('keeps the browser bar color of the %s theme equal to --color-panel-solid', (theme) => {
    expect(THEME_COLOR_BY_THEME[theme].toLowerCase()).toBe(tokens[theme].get('--color-panel-solid')?.toLowerCase());
  });

  it('keeps the manifest background equal to the light --color-canvas', () => {
    expect(MANIFEST_BACKGROUND_COLOR.toLowerCase()).toBe(tokens.light.get('--color-canvas')?.toLowerCase());
  });
});
