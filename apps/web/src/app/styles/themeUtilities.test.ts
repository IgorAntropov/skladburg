import { compile } from 'tailwindcss';
import tailwindCss from 'tailwindcss/index.css?raw';
import {
  describe,
  expect,
  it,
} from 'vitest';

import fontsCss from './fonts.css?raw';
import indexCss from './index.css?raw';
import { readThemeTokens } from './testing/readThemeTokens';
import themeCss from './theme.css?raw';

const STYLESHEET_SOURCES: Readonly<Record<string, string>> = {
  './fonts.css': fontsCss,
  './index.css': indexCss,
  './theme.css': themeCss,
  'tailwindcss': tailwindCss,
};

const SHADOW_COMPOSITE_PARTS = [
  'var(--tw-inset-shadow)',
  'var(--tw-inset-ring-shadow)',
  'var(--tw-ring-offset-shadow)',
  'var(--tw-ring-shadow)',
  'var(--tw-shadow)',
];

const PANEL_SHADOW_COMPOSITE_PARTS = [
  'var(--tw-inset-shadow, 0 0 #0000)',
  'var(--tw-inset-ring-shadow, 0 0 #0000)',
  'var(--tw-ring-offset-shadow, 0 0 #0000)',
  'var(--tw-ring-shadow, 0 0 #0000)',
  'var(--tw-shadow)',
];

const PANEL_SELECTOR = '.shadow-panel';
const RING_SELECTOR = '.ring-1';
const FOCUS_RING_SELECTOR = '.focus-visible\\:ring-2:focus-visible';

const escapeRegExp = (value: string): string => value.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&');

const readBuiltCss = async (candidates: string[]): Promise<string> => {
  const compiler = await compile(indexCss, {
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

const readLastDeclarations = (css: string, selector: string): ReadonlyMap<string, string> => {
  const rulePattern = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, 'g');
  const declarations = new Map<string, string>();
  let ruleCount = 0;

  for (const match of css.matchAll(rulePattern)) {
    ruleCount += 1;

    for (const rawDeclaration of (match[1] ?? '').split(';')) {
      const separatorIndex = rawDeclaration.indexOf(':');
      const name = rawDeclaration.slice(0, separatorIndex).trim();
      const isTrackedDeclaration = separatorIndex > 0 && (name.startsWith('--') || name === 'box-shadow');

      if (isTrackedDeclaration) {
        declarations.set(name, rawDeclaration.slice(separatorIndex + 1).replaceAll(/\s+/g, ' ').trim());
      }
    }
  }

  if (ruleCount === 0) {
    throw new Error(`Rule ${selector} is missing in the compiled stylesheet`);
  }

  return declarations;
};

const splitTopLevel = (value: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const character of value) {
    if (character === '(') {
      depth += 1;
    }

    if (character === ')') {
      depth -= 1;
    }

    const isSeparator = character === ',' && depth === 0;

    if (isSeparator) {
      parts.push(current.trim());
    }

    current = isSeparator ? '' : current + character;
  }

  parts.push(current.trim());

  return parts;
};

const readCompositeParts = (declarations: ReadonlyMap<string, string>): string[] => {
  const boxShadow = declarations.get('box-shadow');

  if (boxShadow === undefined) {
    throw new Error('Declaration box-shadow is missing in the compiled rule');
  }

  return splitTopLevel(boxShadow);
};

describe('panel shadow', () => {
  it('resolves the panel shadow through the theme variable and the Tailwind shadow layer', async () => {
    const css = await readBuiltCss(['shadow-panel', 'ring-1', 'focus-visible:ring-2']);
    const panel = readLastDeclarations(css, PANEL_SELECTOR);

    expect(panel.get('--tw-shadow')).toBe('var(--shadow-panel)');
    expect(readCompositeParts(panel)).toEqual(PANEL_SHADOW_COMPOSITE_PARTS);
  });

  it('keeps the composite shadow valid when no other utility registers the shadow layer', async () => {
    const css = await readBuiltCss(['shadow-panel']);
    const panel = readLastDeclarations(css, PANEL_SELECTOR);

    expect(readCompositeParts(panel)).toEqual(PANEL_SHADOW_COMPOSITE_PARTS);
  });

  it('leaves the ring layer untouched so that rings add to the panel shadow', async () => {
    const css = await readBuiltCss(['shadow-panel', 'ring-1', 'focus-visible:ring-2']);
    const panel = readLastDeclarations(css, PANEL_SELECTOR);
    const ring = readLastDeclarations(css, RING_SELECTOR);
    const focusRing = readLastDeclarations(css, FOCUS_RING_SELECTOR);

    expect(panel.has('--tw-ring-shadow')).toBe(false);
    expect(ring.get('--tw-ring-shadow')).toBeDefined();
    expect(focusRing.get('--tw-ring-shadow')).toBeDefined();
    expect(readCompositeParts(ring)).toEqual(SHADOW_COMPOSITE_PARTS);
    expect(readCompositeParts(focusRing)).toEqual(SHADOW_COMPOSITE_PARTS);
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

describe('side and avatar utilities', () => {
  it('generates classes for the avatar tones and the side colors from the theme tokens', async () => {
    const css = await readBuiltCss([
      'bg-avatar-1',
      'bg-avatar-8',
      'text-on-avatar-1',
      'text-on-avatar-8',
      'text-side-label-customer',
      'text-side-label-supplier',
      'text-side-label-carrier',
      'bg-side-customer',
      'text-on-side-customer',
    ]);

    expect(css).toContain('.bg-avatar-1');
    expect(css).toContain('.bg-avatar-8');
    expect(css).toContain('.text-on-avatar-1');
    expect(css).toContain('.text-on-avatar-8');
    expect(css).toContain('.text-side-label-customer');
    expect(css).toContain('.text-side-label-supplier');
    expect(css).toContain('.text-side-label-carrier');
    expect(css).toContain('.bg-side-customer');
    expect(css).toContain('.text-on-side-customer');
  });

  it('keeps the side fill literal in the utility so that a theme override cannot recolor it', async () => {
    const css = await readBuiltCss(['bg-side-supplier']);

    expect(css).toMatch(/\.bg-side-supplier\s*\{\s*background-color:\s*#596517;?\s*\}/);
  });

  it('points the side label utility at the theme variable', async () => {
    const css = await readBuiltCss(['text-side-label-supplier']);

    expect(css).toMatch(/\.text-side-label-supplier\s*\{\s*color:\s*var\(--color-side-label-supplier\);?\s*\}/);
  });
});

describe('motion tokens', () => {
  it('defines one easing curve and four durations in the light block', () => {
    const { tokens } = readThemeTokens(themeCss);

    expect(tokens.light.get('--ease-out')).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(tokens.light.get('--duration-press')).toBe('100ms');
    expect(tokens.light.get('--duration-fast')).toBe('150ms');
    expect(tokens.light.get('--duration-theme')).toBe('200ms');
    expect(tokens.light.get('--duration-panel')).toBe('300ms');
  });

  it('generates the menu and skeleton animations together with their keyframes', async () => {
    const css = await readBuiltCss(['animate-menu-in', 'animate-skeleton-pulse']);

    expect(css).toMatch(/\.animate-menu-in\s*\{\s*animation:\s*var\(--animate-menu-in\)/);
    expect(css).toMatch(/\.animate-skeleton-pulse\s*\{\s*animation:\s*var\(--animate-skeleton-pulse\)/);
    expect(css).toContain('@keyframes menu-in');
    expect(css).toContain('@keyframes skeleton-pulse');
  });

  it('keeps the skeleton pulse between full and 0.6 opacity', () => {
    const keyframes = /@keyframes skeleton-pulse\s*\{[\s\S]*?50%\s*\{\s*opacity:\s*0\.6;/;

    expect(themeCss).toMatch(keyframes);
  });

  it('points the press utilities at the duration token', async () => {
    const css = await readBuiltCss(['duration-(--duration-press)', 'ease-out']);

    expect(css).toContain('transition-duration: var(--duration-press)');
    expect(css).toMatch(/\.ease-out\s*\{[^}]*var\(--ease-out\)/);
  });

  it('adds the theme crossfade only for users without a reduced motion preference', () => {
    const crossfade = /\(prefers-reduced-motion: no-preference\) \{\s*::view-transition-old\(root\),\s*::view-transition-new\(root\)/;

    expect(indexCss).toMatch(crossfade);
    expect(indexCss).toContain('animation-duration: var(--duration-theme)');
  });

  it('clears the iOS tap highlight on interactive elements', () => {
    expect(indexCss).toContain('-webkit-tap-highlight-color: transparent');
  });
});

describe('stylesheet sources', () => {
  it('keeps test files and test helpers out of the class scan', () => {
    expect(indexCss).toMatch(/^@source not '[^']*\*\.test\.\*';$/m);
    expect(indexCss).toMatch(/^@source not '[^']*\/testing';$/m);
  });
});
