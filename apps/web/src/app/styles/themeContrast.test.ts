import {
  describe,
  expect,
  it,
} from 'vitest';

import type { RgbaColorValue } from '@/shared/lib/color';

import {
  compositeOver,
  contrastRatio,
  parseCssColor,
} from '@/shared/lib/color';

import type { ThemeNameValue } from './testing/readThemeTokens';

import { readThemeTokens } from './testing/readThemeTokens';
import themeCss from './theme.css?raw';

interface BackdropValue {
  color: RgbaColorValue;
  label: string;
}

interface ContrastCaseValue {
  background: string;
  foreground: string;
  theme: ThemeNameValue;
  threshold: number;
}

interface ContrastPairValue {
  backgrounds: readonly string[];
  foregrounds: readonly string[];
  isBareStatusIcon?: boolean;
  threshold: number;
}

const THEME_NAMES: readonly ThemeNameValue[] = ['light', 'dark'];

const TEXT_THRESHOLD = 4.5;
const GRAPHIC_THRESHOLD = 3;

const BARE_STATUS_ICON_THEMES: readonly ThemeNameValue[] = ['dark'];

const WORLD_BACKGROUNDS: readonly string[] = [
  '#E8E4DC',
  '#D4A867',
  '#F2711C',
  '#2BB0C9',
  '#1E2A4A',
  '#FFFFFF',
  '#000000',
];

const STATUS_NAMES: readonly string[] = ['ok', 'warning', 'alarm'];

const BRAND_TOKEN_NAMES: readonly string[] = [
  'primary',
  'on-primary',
  'accent',
  'on-accent',
];

const STATUS_TOKEN_NAMES: readonly string[] = [
  ...STATUS_NAMES.map(name => `status-${name}`),
  ...STATUS_NAMES.map(name => `on-status-${name}`),
];

const THEME_DEPENDENT_TOKEN_NAMES: readonly string[] = [
  'canvas',
  'on-canvas',
  'on-canvas-muted',
  'panel',
  'panel-solid',
  'on-panel',
  'on-panel-muted',
  'line',
  'line-strong',
  'link',
  'indicator',
  'focus',
  'skeleton',
  'scrim',
];

const CONTRACT_TOKEN_NAMES: readonly string[] = [
  ...BRAND_TOKEN_NAMES,
  ...THEME_DEPENDENT_TOKEN_NAMES,
  ...STATUS_TOKEN_NAMES,
];

const CONTRAST_PAIRS: readonly ContrastPairValue[] = [
  {
    backgrounds: ['canvas'],
    foregrounds: ['on-canvas', 'on-canvas-muted'],
    threshold: TEXT_THRESHOLD,
  },
  {
    backgrounds: ['panel', 'panel-solid'],
    foregrounds: ['on-panel', 'on-panel-muted'],
    threshold: TEXT_THRESHOLD,
  },
  {
    backgrounds: ['panel', 'panel-solid', 'canvas'],
    foregrounds: ['link'],
    threshold: TEXT_THRESHOLD,
  },
  {
    backgrounds: ['panel', 'panel-solid', 'canvas'],
    foregrounds: ['indicator'],
    threshold: GRAPHIC_THRESHOLD,
  },
  {
    backgrounds: ['primary'],
    foregrounds: ['on-primary'],
    threshold: TEXT_THRESHOLD,
  },
  {
    backgrounds: ['accent'],
    foregrounds: ['on-accent'],
    threshold: TEXT_THRESHOLD,
  },
  ...STATUS_NAMES.map((name): ContrastPairValue => ({
    backgrounds: [`status-${name}`],
    foregrounds: [`on-status-${name}`],
    threshold: TEXT_THRESHOLD,
  })),
  {
    backgrounds: ['panel', 'panel-solid', 'canvas', 'primary'],
    foregrounds: ['focus'],
    threshold: GRAPHIC_THRESHOLD,
  },
  {
    backgrounds: ['panel', 'panel-solid', 'canvas'],
    foregrounds: ['line-strong'],
    threshold: GRAPHIC_THRESHOLD,
  },
  {
    backgrounds: ['panel-solid', 'canvas'],
    foregrounds: STATUS_NAMES.map(name => `status-${name}`),
    isBareStatusIcon: true,
    threshold: GRAPHIC_THRESHOLD,
  },
];

const { darkOverrideNames, tokens } = readThemeTokens(themeCss);

const readColor = (theme: ThemeNameValue, name: string): RgbaColorValue => {
  const tokenName = `--color-${name}`;
  const rawValue = tokens[theme].get(tokenName);

  if (rawValue === undefined) {
    throw new Error(`Token ${tokenName} is missing in the ${theme} theme`);
  }

  const color = parseCssColor(rawValue);

  if (color === undefined) {
    throw new Error(`Token ${tokenName} in the ${theme} theme has an unparsable value: ${rawValue}`);
  }

  return color;
};

const parseWorldBackground = (value: string): RgbaColorValue => {
  const color = parseCssColor(value);

  if (color === undefined) {
    throw new Error(`World background ${value} is unparsable`);
  }

  return color;
};

const readBackdrops = (theme: ThemeNameValue, name: string): BackdropValue[] => {
  const color = readColor(theme, name);

  if (color.alpha >= 1) {
    return [{ color, label: name }];
  }

  const canvasBackdrop: BackdropValue = {
    color: compositeOver(color, readColor(theme, 'canvas')),
    label: `${name} over canvas`,
  };

  const worldBackdrops = WORLD_BACKGROUNDS.map((world): BackdropValue => ({
    color: compositeOver(color, parseWorldBackground(world)),
    label: `${name} over ${world}`,
  }));

  return [canvasBackdrop, ...worldBackdrops];
};

const measureWorstContrast = (contrastCase: ContrastCaseValue): { label: string; ratio: number } => {
  const foreground = readColor(contrastCase.theme, contrastCase.foreground);
  const backdrops = readBackdrops(contrastCase.theme, contrastCase.background);

  return backdrops
    .map(backdrop => ({
      label: backdrop.label,
      ratio: contrastRatio(foreground, backdrop.color),
    }))
    .reduce((worst, current) => (current.ratio < worst.ratio ? current : worst));
};

const isPairApplicable = (pair: ContrastPairValue, theme: ThemeNameValue): boolean => {
  return pair.isBareStatusIcon !== true || BARE_STATUS_ICON_THEMES.includes(theme);
};

const CONTRAST_CASES: readonly ContrastCaseValue[] = THEME_NAMES.flatMap((theme) => {
  return CONTRAST_PAIRS
    .filter(pair => isPairApplicable(pair, theme))
    .flatMap(pair => pair.foregrounds.flatMap((foreground) => {
      return pair.backgrounds.map((background): ContrastCaseValue => ({
        background,
        foreground,
        theme,
        threshold: pair.threshold,
      }));
    }));
});

describe('theme tokens contract', () => {
  it.each(THEME_NAMES)('defines every contract token with a parsable color in the %s theme', (theme) => {
    for (const name of CONTRACT_TOKEN_NAMES) {
      expect(readColor(theme, name)).toBeDefined();
    }
  });

  it('overrides every theme-dependent token in the dark block', () => {
    const missingOverrides = THEME_DEPENDENT_TOKEN_NAMES
      .map(name => `--color-${name}`)
      .filter(tokenName => !darkOverrideNames.includes(tokenName));

    expect(missingOverrides).toEqual([]);
  });

  it('keeps brand and status tokens out of the dark block', () => {
    const overriddenFixedTokens = [...BRAND_TOKEN_NAMES, ...STATUS_TOKEN_NAMES]
      .map(name => `--color-${name}`)
      .filter(tokenName => darkOverrideNames.includes(tokenName));

    expect(overriddenFixedTokens).toEqual([]);
  });

  it('gives brand and status tokens the same values in both themes', () => {
    for (const name of [...BRAND_TOKEN_NAMES, ...STATUS_TOKEN_NAMES]) {
      expect(readColor('dark', name)).toEqual(readColor('light', name));
    }
  });

  it.each(THEME_NAMES)('mixes the translucent panel with the canvas and every world background in the %s theme', (theme) => {
    expect(readBackdrops(theme, 'panel')).toHaveLength(WORLD_BACKGROUNDS.length + 1);
    expect(readBackdrops(theme, 'panel-solid')).toHaveLength(1);
  });

  it('reports a missing token with its name and theme', () => {
    expect(() => readColor('dark', 'no-such-token')).toThrow(
      'Token --color-no-such-token is missing in the dark theme',
    );
  });
});

const readPanelBackdrops = (theme: ThemeNameValue): RgbaColorValue[] => {
  return readBackdrops(theme, 'panel').map(backdrop => backdrop.color);
};

const readSegmentedTrackBackdrops = (theme: ThemeNameValue): RgbaColorValue[] => {
  const track = readColor(theme, 'skeleton');

  return readPanelBackdrops(theme).map(panel => compositeOver(track, panel));
};

const readWorstRatio = (foreground: RgbaColorValue, backdrops: readonly RgbaColorValue[]): number => {
  return Math.min(...backdrops.map(backdrop => contrastRatio(foreground, backdrop)));
};

describe('top bar state contrast', () => {
  it.each(THEME_NAMES)('separates the selected segmented option border from the track in the %s theme', (theme) => {
    const ratio = readWorstRatio(readColor(theme, 'indicator'), readSegmentedTrackBackdrops(theme));

    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_THRESHOLD);
  });

  it.each(THEME_NAMES)('keeps the text of an unselected option and of a hovered link readable on the fill in the %s theme', (theme) => {
    const ratio = readWorstRatio(readColor(theme, 'on-panel'), readSegmentedTrackBackdrops(theme));

    expect(ratio).toBeGreaterThanOrEqual(TEXT_THRESHOLD);
  });

  it.each(THEME_NAMES)('keeps the muted section link text readable on the panel in the %s theme', (theme) => {
    const ratio = readWorstRatio(readColor(theme, 'on-panel-muted'), readPanelBackdrops(theme));

    expect(ratio).toBeGreaterThanOrEqual(TEXT_THRESHOLD);
  });
});

describe('theme contrast', () => {
  it.each(CONTRAST_CASES)(
    '$theme theme: $foreground on $background reaches $threshold',
    (contrastCase) => {
      const worst = measureWorstContrast(contrastCase);

      expect(
        worst.ratio,
        `${contrastCase.theme} theme: ${contrastCase.foreground} on ${worst.label}`
        + ` is ${worst.ratio.toFixed(2)}, required ${contrastCase.threshold.toFixed(1)}`,
      ).toBeGreaterThanOrEqual(contrastCase.threshold);
    },
  );
});
