import { compile } from 'tailwindcss';
import tailwindCss from 'tailwindcss/index.css?raw';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { readThemeTokens } from './testing/readThemeTokens';
import themeCss from './theme.css?raw';

const STYLESHEET_SOURCES: Readonly<Record<string, string>> = {
  './theme.css': themeCss,
  'tailwindcss': tailwindCss,
};

const ENTRY_STYLESHEET = '@import \'tailwindcss\';\n@import \'./theme.css\';';

const SHADOW_PANEL_RULE = /\.shadow-panel\s*\{([^}]*)\}/;

const readBuiltCss = async (candidates: string[]): Promise<string> => {
  const compiler = await compile(ENTRY_STYLESHEET, {
    base: '/',
    loadStylesheet: (id, base) => {
      const content = STYLESHEET_SOURCES[id];

      if (content === undefined) {
        return Promise.reject(new Error(`Stylesheet ${id} is not provided to the test compiler`));
      }

      return Promise.resolve({ base, content, path: id });
    },
  });

  return compiler.build(candidates);
};

const readBoxShadowDeclarations = (css: string): string[] => {
  const body = SHADOW_PANEL_RULE.exec(css)?.[1];

  if (body === undefined) {
    throw new Error('Rule .shadow-panel is missing in the compiled stylesheet');
  }

  return body
    .split(';')
    .map(declaration => declaration.trim())
    .filter(declaration => declaration.startsWith('box-shadow:'))
    .map(declaration => declaration.slice('box-shadow:'.length).trim());
};

describe('panel shadow', () => {
  it('ends the compiled shadow-panel rule with a reference to the theme variable', async () => {
    const declarations = readBoxShadowDeclarations(await readBuiltCss(['shadow-panel']));

    expect(declarations.length).toBeGreaterThan(1);
    expect(declarations.at(-1)).toBe('var(--shadow-panel)');
  });

  it('gives the dark theme its own panel shadow', () => {
    const { darkOverrideNames, tokens } = readThemeTokens(themeCss);
    const lightShadow = tokens.light.get('--shadow-panel');
    const darkShadow = tokens.dark.get('--shadow-panel');

    expect(darkOverrideNames).toContain('--shadow-panel');
    expect(lightShadow).toBeDefined();
    expect(darkShadow).toBeDefined();
    expect(darkShadow).not.toBe(lightShadow);
  });
});
