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
const SKELETON_SEPARATION_THRESHOLD = 1.3;

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

const SIDE_NAMES: readonly string[] = ['customer', 'supplier', 'carrier'];

const AVATAR_TONE_COUNT = 8;

const AVATAR_INDEXES: readonly string[] = Array.from({ length: AVATAR_TONE_COUNT }, (_, index) => String(index + 1));

const LAST_AVATAR_INDEX = String(AVATAR_TONE_COUNT);

const OVERFLOW_AVATAR_INDEX = String(AVATAR_TONE_COUNT + 1);

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

const SIDE_TOKEN_NAMES: readonly string[] = [
  ...SIDE_NAMES.map(name => `side-${name}`),
  ...SIDE_NAMES.map(name => `on-side-${name}`),
];

const SIDE_LABEL_TOKEN_NAMES: readonly string[] = SIDE_NAMES.map(name => `side-label-${name}`);

const AVATAR_TOKEN_NAMES: readonly string[] = [
  ...AVATAR_INDEXES.map(index => `avatar-${index}`),
  ...AVATAR_INDEXES.map(index => `on-avatar-${index}`),
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
  'hover',
  'skeleton',
  'scrim',
  ...SIDE_LABEL_TOKEN_NAMES,
  ...AVATAR_TOKEN_NAMES,
];

const CONTRACT_TOKEN_NAMES: readonly string[] = [
  ...BRAND_TOKEN_NAMES,
  ...THEME_DEPENDENT_TOKEN_NAMES,
  ...STATUS_TOKEN_NAMES,
  ...SIDE_TOKEN_NAMES,
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
    backgrounds: ['panel', 'panel-solid', 'canvas'],
    foregrounds: SIDE_LABEL_TOKEN_NAMES,
    threshold: TEXT_THRESHOLD,
  },
  ...SIDE_NAMES.map((name): ContrastPairValue => ({
    backgrounds: [`side-${name}`],
    foregrounds: [`on-side-${name}`],
    threshold: TEXT_THRESHOLD,
  })),
  ...AVATAR_INDEXES.map((index): ContrastPairValue => ({
    backgrounds: [`avatar-${index}`],
    foregrounds: [`on-avatar-${index}`],
    threshold: TEXT_THRESHOLD,
  })),
  {
    backgrounds: ['panel-solid', 'canvas'],
    foregrounds: AVATAR_INDEXES.map(index => `avatar-${index}`),
    threshold: GRAPHIC_THRESHOLD,
  },
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

  it('keeps brand, status and side fill tokens out of the dark block', () => {
    const overriddenFixedTokens = [...BRAND_TOKEN_NAMES, ...STATUS_TOKEN_NAMES, ...SIDE_TOKEN_NAMES]
      .map(name => `--color-${name}`)
      .filter(tokenName => darkOverrideNames.includes(tokenName));

    expect(overriddenFixedTokens).toEqual([]);
  });

  it('gives brand, status and side fill tokens the same values in both themes', () => {
    for (const name of [...BRAND_TOKEN_NAMES, ...STATUS_TOKEN_NAMES, ...SIDE_TOKEN_NAMES]) {
      expect(readColor('dark', name)).toEqual(readColor('light', name));
    }
  });

  it('keeps the light side label equal to the side fill', () => {
    for (const name of SIDE_NAMES) {
      expect(readColor('light', `side-label-${name}`)).toEqual(readColor('light', `side-${name}`));
    }
  });

  it('gives the three sides pairwise different labels in each theme', () => {
    for (const theme of THEME_NAMES) {
      const labels = SIDE_NAMES.map(name => tokens[theme].get(`--color-side-label-${name}`));

      expect(new Set(labels).size).toBe(SIDE_NAMES.length);
    }
  });

  it.each(THEME_NAMES)('defines exactly the declared number of avatar tones in the %s theme', (theme) => {
    expect(tokens[theme].has(`--color-avatar-${LAST_AVATAR_INDEX}`)).toBe(true);
    expect(tokens[theme].has(`--color-avatar-${OVERFLOW_AVATAR_INDEX}`)).toBe(false);
    expect(tokens[theme].has(`--color-on-avatar-${OVERFLOW_AVATAR_INDEX}`)).toBe(false);
  });

  it.each(THEME_NAMES)('gives every avatar tone its own color in the %s theme', (theme) => {
    const tones = AVATAR_INDEXES.map(index => tokens[theme].get(`--color-avatar-${index}`));

    expect(new Set(tones).size).toBe(AVATAR_TONE_COUNT);
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

const readHoverBackdrops = (theme: ThemeNameValue): RgbaColorValue[] => {
  const hover = readColor(theme, 'hover');
  const canvasBackdrop = compositeOver(hover, readColor(theme, 'canvas'));

  return [canvasBackdrop, ...readPanelBackdrops(theme).map(panel => compositeOver(hover, panel))];
};

const readSkeletonBackdrops = (theme: ThemeNameValue): RgbaColorValue[] => {
  return [readColor(theme, 'panel-solid'), ...readPanelBackdrops(theme)];
};

describe('skeleton and hover fills', () => {
  it.each(THEME_NAMES)('separates the skeleton fill from the solid panel and the panel over every world in the %s theme', (theme) => {
    const skeleton = readColor(theme, 'skeleton');
    const ratios = readSkeletonBackdrops(theme).map(backdrop => contrastRatio(compositeOver(skeleton, backdrop), backdrop));
    const worst = Math.min(...ratios);

    expect(worst).toBeGreaterThanOrEqual(SKELETON_SEPARATION_THRESHOLD);
  });

  it.each(THEME_NAMES)('keeps the hover fill weaker than the skeleton fill in the %s theme', (theme) => {
    expect(readColor(theme, 'hover').alpha).toBeLessThan(readColor(theme, 'skeleton').alpha);
  });

  it.each(THEME_NAMES)('keeps the text of a hovered control readable on the hover fill in the %s theme', (theme) => {
    const ratio = readWorstRatio(readColor(theme, 'on-panel'), readHoverBackdrops(theme));

    expect(ratio).toBeGreaterThanOrEqual(TEXT_THRESHOLD);
  });

  it.each(THEME_NAMES)('keeps the muted text readable on the hover fill of a selected menu cell in the %s theme', (theme) => {
    const solidHover = compositeOver(readColor(theme, 'hover'), readColor(theme, 'panel-solid'));
    const ratio = contrastRatio(readColor(theme, 'on-panel-muted'), solidHover);

    expect(ratio).toBeGreaterThanOrEqual(TEXT_THRESHOLD);
  });
});

describe('HUD zone state contrast', () => {
  it.each(THEME_NAMES)('keeps the empty state icon visible on the skeleton fill over the panel in the %s theme', (theme) => {
    const ratio = readWorstRatio(readColor(theme, 'on-panel-muted'), readSegmentedTrackBackdrops(theme));

    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_THRESHOLD);
  });

  it.each(THEME_NAMES)('keeps the text of the selected nested tab readable on the indicator fill in the %s theme', (theme) => {
    const ratio = contrastRatio(readColor(theme, 'panel-solid'), readColor(theme, 'indicator'));

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
