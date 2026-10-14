import { readFileSync } from 'node:fs';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { BootFallbackColorsValue } from './bootFallbackTypes.ts';

import { readThemeTokens } from '../src/app/styles/testing/readThemeTokens.ts';
import {
  BOOT_FALLBACK_COLORS,
  createBootFallbackStyle,
} from './bootFallbackStyle.ts';

const { tokens } = readThemeTokens(readFileSync(new URL('../src/app/styles/theme.css', import.meta.url), 'utf8'));

const TOKEN_BY_COLOR_FIELD: Readonly<Record<keyof BootFallbackColorsValue, string>> = {
  background: '--color-canvas',
  badge: '--color-status-alarm',
  badgeIcon: '--color-on-status-alarm',
  button: '--color-primary',
  buttonText: '--color-on-primary',
  focus: '--color-focus',
  text: '--color-on-canvas',
};

describe('boot fallback colors', () => {
  it.each(['light', 'dark'] as const)('match the tokens of the %s theme', (theme) => {
    const colors = BOOT_FALLBACK_COLORS[theme];
    const themeTokens = tokens[theme];

    expect(Object.keys(colors).toSorted()).toEqual(Object.keys(TOKEN_BY_COLOR_FIELD).toSorted());

    for (const [field, token] of Object.entries(TOKEN_BY_COLOR_FIELD)) {
      const tokenValue = themeTokens.get(token);

      expect(tokenValue, `${theme}: ${token}`).toBeDefined();
      expect(colors[field as keyof BootFallbackColorsValue].toLowerCase(), `${theme}: ${field}`).toBe(tokenValue?.toLowerCase());
    }
  });
});

describe('createBootFallbackStyle', () => {
  const style = createBootFallbackStyle('boot-fallback');

  it('keeps the block hidden while the hidden attribute is set', () => {
    expect(style).toContain('#boot-fallback:not([hidden]){display:flex}');
  });

  it('paints both themes with the colors of the tokens', () => {
    expect(style).toContain(`#boot-fallback{background:${BOOT_FALLBACK_COLORS.light.background}`);
    expect(style).toContain(`[data-theme="dark"] #boot-fallback{background:${BOOT_FALLBACK_COLORS.dark.background}`);
  });
});
