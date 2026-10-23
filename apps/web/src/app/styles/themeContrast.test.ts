import {
  describe,
  expect,
  it,
} from 'vitest';

import type { LinearRgbValue } from '@/shared/3d';
import type { RgbaColorValue } from '@/shared/lib/color';

import {
  compositeOver,
  contrastRatio,
  parseCssColor,
  relativeLuminance,
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

const { darkOverrideNames, tokens } = readThemeTokens(themeCss);

const {
  applyWorldToneCurve,
  DAY_NIGHT_KEYFRAMES,
  MIN_LIGHT_ELEVATION_RADIANS,
} = await import('@/shared/3d');

const WORLD_TOKEN_PREFIX = '--world-';

const WORLD_LIGHT_TOKEN_NAMES: readonly string[] = [
  'sun-day',
  'sky-day',
  'ground-day',
  'sun-sunset',
  'sky-sunset',
  'moon',
  'sky-night',
  'ground-night',
];

const WORLD_GLOW_TOKEN_NAMES: readonly string[] = [
  'window-glow',
  'lamp-glow',
  'light-pool',
];

const WORLD_TERRAIN_TOKEN_NAMES: readonly string[] = [
  'background',
  'ground',
  'ground-alt',
  'field',
  'field-alt',
  'sand',
  'water',
  'tree-crown',
  'tree-crown-dark',
  'tree-trunk',
  'rock',
  'background-night',
];

const WORLD_TOKEN_DECLARATION_PATTERN = /--world-([\w-]+)\s*:\s*([^;}]*)[;}]/g;

const WORLD_HEX_PATTERN = /^#[\da-f]{6}$/;

const readWorldDeclarations = (): [string, string][] => {
  return Array.from(themeCss.matchAll(WORLD_TOKEN_DECLARATION_PATTERN), (match): [string, string] => [
    match[1] ?? '',
    (match[2] ?? '').trim(),
  ]);
};

const readWorldTokens = (): Map<string, string> => new Map(readWorldDeclarations());

const readWorldSurfaceEntries = (): [string, string][] => {
  return [...readWorldTokens()].filter(([name]) => {
    return !WORLD_LIGHT_TOKEN_NAMES.includes(name) && !WORLD_GLOW_TOKEN_NAMES.includes(name);
  });
};

const readWorldSurfaceTokens = (): string[] => {
  return readWorldSurfaceEntries().map(([, value]) => value);
};

const WORLD_BACKGROUNDS: readonly string[] = [
  ...readWorldSurfaceTokens(),
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

const WORLD_CITY_TOKEN_NAMES: readonly string[] = [
  'road',
  'plaza',
  'building-wall',
  'building-brick',
  'building-roof',
  'building-roof-alt',
  'warehouse-wall',
  'warehouse-roof',
  'side-customer',
  'side-supplier',
  'side-carrier',
  'side-rim',
];

const WORLD_GRASS_TOKEN_NAMES: readonly string[] = ['ground', 'ground-alt'];

const WORLD_OPEN_GROUND_TOKEN_NAMES: readonly string[] = [
  'ground',
  'ground-alt',
  'field',
  'field-alt',
  'sand',
];

const WORLD_ROOF_TOKEN_NAMES: readonly string[] = [
  'building-brick',
  'building-roof',
  'building-roof-alt',
  'warehouse-roof',
];

const ROAD_COLOR_DISTANCE = 40;
const ROAD_LUMINANCE_CONTRAST = 2.9;
const PLAZA_COLOR_DISTANCE = 15;
const ROOF_COLOR_DISTANCE = 25;
const WALL_COLOR_DISTANCE = 25;

const LAB_WHITE_X = 0.95047;
const LAB_WHITE_Z = 1.08883;
const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

const linearizeChannel = (channel: number): number => {
  const unit = channel / 255;

  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};

const toLabAxis = (ratio: number): number => {
  return ratio > LAB_EPSILON ? Math.cbrt(ratio) : (LAB_KAPPA * ratio + 16) / 116;
};

const toLab = (color: RgbaColorValue): [number, number, number] => {
  const red = linearizeChannel(color.red);
  const green = linearizeChannel(color.green);
  const blue = linearizeChannel(color.blue);
  const x = toLabAxis((0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) / LAB_WHITE_X);
  const y = toLabAxis(0.2126729 * red + 0.7151522 * green + 0.072175 * blue);
  const z = toLabAxis((0.0193339 * red + 0.119192 * green + 0.9503041 * blue) / LAB_WHITE_Z);

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};

const readWorldColor = (name: string): RgbaColorValue => {
  const rawValue = readWorldTokens().get(name);

  if (rawValue === undefined) {
    throw new Error(`World token ${WORLD_TOKEN_PREFIX}${name} is missing`);
  }

  return parseWorldBackground(rawValue);
};

const measureColorDistance = (firstName: string, secondName: string): number => {
  const [firstL, firstA, firstB] = toLab(readWorldColor(firstName));
  const [secondL, secondA, secondB] = toLab(readWorldColor(secondName));

  return Math.hypot(firstL - secondL, firstA - secondA, firstB - secondB);
};

const measureLuminanceContrast = (firstName: string, secondName: string): number => {
  return contrastRatio(readWorldColor(firstName), readWorldColor(secondName));
};

const readColorPairs = (
  firstNames: readonly string[],
  secondNames: readonly string[],
): [string, string][] => {
  return firstNames.flatMap(first => secondNames.map((second): [string, string] => [first, second]));
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

  it('declares every world token as a lowercase six-digit hex color', () => {
    const invalidTokens = [...readWorldTokens()]
      .filter(([, value]) => !WORLD_HEX_PATTERN.test(value))
      .map(([name, value]) => `${WORLD_TOKEN_PREFIX}${name}: ${value}`);

    expect(invalidTokens).toEqual([]);
  });

  it('declares every world token once', () => {
    const names = readWorldDeclarations().map(([name]) => name);

    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it('declares every light token of the world', () => {
    const missingLightTokens = WORLD_LIGHT_TOKEN_NAMES.filter(name => !readWorldTokens().has(name));

    expect(missingLightTokens).toEqual([]);
  });

  it('keeps the world background equal to the ground', () => {
    expect(readWorldTokens().get('background')).toBe(readWorldTokens().get('ground'));
  });

  it('keeps world tokens out of the dark block', () => {
    const overriddenWorldTokens = darkOverrideNames.filter(name => name.startsWith(WORLD_TOKEN_PREFIX));

    expect(overriddenWorldTokens).toEqual([]);
  });

  it('declares every terrain surface of the world and counts it as a panel backdrop', () => {
    const surfaceNames = readWorldSurfaceEntries().map(([name]) => name);

    expect(surfaceNames.toSorted()).toEqual(expect.arrayContaining(WORLD_TERRAIN_TOKEN_NAMES.toSorted()));
    expect(surfaceNames.some(name => WORLD_LIGHT_TOKEN_NAMES.includes(name))).toBe(false);
    expect(WORLD_BACKGROUNDS).toEqual(expect.arrayContaining(readWorldSurfaceTokens()));
  });

  it('reports a missing token with its name and theme', () => {
    expect(() => readColor('dark', 'no-such-token')).toThrow(
      'Token --color-no-such-token is missing in the dark theme',
    );
  });
});

describe('world city surfaces', () => {
  it('declares every color of the mini city', () => {
    const missingNames = WORLD_CITY_TOKEN_NAMES.filter(name => !readWorldTokens().has(name));

    expect(missingNames).toEqual([]);
  });

  it.each(SIDE_NAMES)('copies the %s fill of the side into the world in both themes', (name) => {
    const worldValue = readWorldTokens().get(`side-${name}`);

    expect(worldValue).toBe(tokens.light.get(`--color-side-${name}`));
    expect(worldValue).toBe(tokens.dark.get(`--color-side-${name}`));
  });

  it.each(SIDE_NAMES)('copies the %s rim of the side into the world in both themes', (name) => {
    const worldValue = readWorldTokens().get('side-rim');

    expect(worldValue).toBe(tokens.light.get(`--color-on-side-${name}`));
    expect(worldValue).toBe(tokens.dark.get(`--color-on-side-${name}`));
  });

  it.each(readColorPairs(['road'], WORLD_OPEN_GROUND_TOKEN_NAMES))('tells the %s from the %s by hue and by lightness', (road, ground) => {
    expect(measureColorDistance(road, ground)).toBeGreaterThanOrEqual(ROAD_COLOR_DISTANCE);
    expect(measureLuminanceContrast(road, ground)).toBeGreaterThanOrEqual(ROAD_LUMINANCE_CONTRAST);
  });

  it.each(readColorPairs(['plaza'], [...WORLD_OPEN_GROUND_TOKEN_NAMES, 'road']))('tells the %s from the %s', (plaza, other) => {
    expect(measureColorDistance(plaza, other)).toBeGreaterThanOrEqual(PLAZA_COLOR_DISTANCE);
  });

  it.each(readColorPairs(WORLD_ROOF_TOKEN_NAMES, WORLD_GRASS_TOKEN_NAMES))('tells the %s from the %s', (roof, grass) => {
    expect(measureColorDistance(roof, grass)).toBeGreaterThanOrEqual(ROOF_COLOR_DISTANCE);
  });

  it.each([
    ['building-wall', 'building-brick'],
    ['building-wall', 'building-roof'],
    ['building-wall', 'building-roof-alt'],
    ['warehouse-wall', 'warehouse-roof'],
  ])('tells the %s from the %s', (wall, roof) => {
    expect(measureColorDistance(wall, roof)).toBeGreaterThanOrEqual(WALL_COLOR_DISTANCE);
  });

  it('keeps the warehouse roof apart from the roofs of the houses', () => {
    expect(measureColorDistance('warehouse-roof', 'building-brick')).toBeGreaterThanOrEqual(WALL_COLOR_DISTANCE);
    expect(measureColorDistance('warehouse-roof', 'building-roof')).toBeGreaterThanOrEqual(WALL_COLOR_DISTANCE);
    expect(measureColorDistance('warehouse-roof', 'building-roof-alt')).toBeGreaterThanOrEqual(WALL_COLOR_DISTANCE);
  });

  it('keeps the road darker than the plaza', () => {
    expect(relativeLuminance(readWorldColor('road'))).toBeLessThan(relativeLuminance(readWorldColor('plaza')));
  });
});

type FaceNormalValue = readonly [number, number, number];

interface WorldPhasePaletteValue {
  ground: string;
  light: string;
  sky: string;
}

type WorldPhaseValue = 'day' | 'night';

const WORLD_PHASE_PALETTES: Readonly<Record<WorldPhaseValue, WorldPhasePaletteValue>> = {
  day: {
    ground: 'ground-day',
    light: 'sun-day',
    sky: 'sky-day',
  },
  night: {
    ground: 'ground-night',
    light: 'moon',
    sky: 'sky-night',
  },
};

const UP_NORMAL: FaceNormalValue = [0, 1, 0];

const WALL_NORMALS: readonly FaceNormalValue[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const WORLD_WALL_TOKEN_NAMES: readonly string[] = ['building-wall', 'warehouse-wall'];

const WORLD_CORNER_GROUND_TOKEN_NAMES: readonly string[] = [...WORLD_OPEN_GROUND_TOKEN_NAMES, 'plaza'];

const WORLD_POOL_GROUND_TOKEN_NAMES: readonly string[] = [...WORLD_OPEN_GROUND_TOKEN_NAMES, 'plaza', 'road'];

const GLOW_CONTRAST = 3;
const WINDOW_SWITCH_CONTRAST = 8;
const WINDOW_GLASS_DAY_CONTRAST = 3;
const WINDOW_GLASS_NIGHT_CONTRAST = 1.5;
const LIGHT_POOL_DISC_STRENGTH = 0.105;
const LIGHT_POOL_DISC_COUNT = 3;
const LIGHT_POOL_STRENGTH = LIGHT_POOL_DISC_STRENGTH * LIGHT_POOL_DISC_COUNT;
const LIGHT_POOL_MIN_CONTRAST = 1.5;
const LIGHT_POOL_MAX_LUMINANCE = 0.3;
const LAMP_OVER_POOL_CONTRAST = 2.5;
const HALO_SHELL_STRENGTH = 0.085;
const HALO_SHELL_COUNT = 2;
const HALO_MIN_CONTRAST = 1.15;
const POOL_WARM_MIN_RED_OVER_BLUE = 15;
const POOL_WARM_MIN_RED_OVER_GREEN = 10;
const SCREEN_CHANNEL_MAX = 255;
const ROAD_NIGHT_CONTRAST = 1.7;
const CORNER_GROUND_CONTRAST = 3;
const CORNER_LAYERS_CONTRAST = 5;
const RIM_NIGHT_CONTRAST = 4.5;
const DAY_OPEN_GROUND_LIGHTENING_LIMIT = 0.032;
const SCREEN_MODEL_TOLERANCE = 2;

const delinearizeChannel = (linear: number): number => {
  const clamped = Math.min(1, Math.max(0, linear));
  const unit = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;

  return unit * 255;
};

const toLinearColor = (color: RgbaColorValue): LinearRgbValue => {
  return [linearizeChannel(color.red), linearizeChannel(color.green), linearizeChannel(color.blue)];
};

const fromLinearColor = (linear: LinearRgbValue): RgbaColorValue => {
  return {
    alpha: 1,
    blue: delinearizeChannel(linear[2]),
    green: delinearizeChannel(linear[1]),
    red: delinearizeChannel(linear[0]),
  };
};

const lightFace = (albedo: RgbaColorValue, phase: WorldPhaseValue, normal: FaceNormalValue): RgbaColorValue => {
  const keyframe = DAY_NIGHT_KEYFRAMES[phase];
  const palette = WORLD_PHASE_PALETTES[phase];
  const albedoLinear = toLinearColor(albedo);
  const skyLinear = toLinearColor(readWorldColor(palette.sky));
  const groundLinear = toLinearColor(readWorldColor(palette.ground));
  const lightLinear = toLinearColor(readWorldColor(palette.light));
  const hemisphereWeight = 0.5 + 0.5 * normal[1];
  const elevation = Math.max(MIN_LIGHT_ELEVATION_RADIANS, keyframe.lightElevationRadians);
  const horizontal = Math.cos(elevation);
  const direction: FaceNormalValue = [
    horizontal * Math.sin(keyframe.lightAzimuthRadians),
    Math.sin(elevation),
    horizontal * Math.cos(keyframe.lightAzimuthRadians),
  ];
  const facing = Math.max(0, normal[0] * direction[0] + normal[1] * direction[1] + normal[2] * direction[2]);

  const lightChannel = (channel: 0 | 1 | 2): number => {
    const hemisphere = skyLinear[channel] * hemisphereWeight + groundLinear[channel] * (1 - hemisphereWeight);
    const irradiance = hemisphere * keyframe.hemisphereIntensity
      + lightLinear[channel] * keyframe.lightIntensity * facing;

    return (albedoLinear[channel] * irradiance) / Math.PI;
  };

  const lit: LinearRgbValue = [lightChannel(0), lightChannel(1), lightChannel(2)];

  return fromLinearColor(applyWorldToneCurve(lit, keyframe.exposure));
};

const lightFlatSurface = (name: string, phase: WorldPhaseValue): RgbaColorValue => {
  return lightFace(readWorldColor(name), phase, UP_NORMAL);
};

type MeasuredScreenColorValue = readonly [number, number, number];

const MEASURED_NIGHT_SURFACES: readonly (readonly [string, MeasuredScreenColorValue])[] = [
  ['ground', [59, 82, 100]],
  ['ground-alt', [50, 74, 85]],
  ['field', [77, 93, 105]],
  ['sand', [87, 99, 125]],
];

const MEASURED_DAY_SURFACES: readonly (readonly [string, MeasuredScreenColorValue])[] = [
  ['ground', [161, 177, 140]],
  ['ground-alt', [139, 162, 120]],
  ['field', [204, 200, 147]],
];

const DAY_OPEN_GROUND_TOKEN_NAMES: readonly string[] = ['ground', 'ground-alt', 'field', 'field-alt'];

const readScreenChannels = (color: RgbaColorValue): number[] => [color.red, color.green, color.blue];

const readNightSurfaces = (): RgbaColorValue[] => {
  const flat = WORLD_POOL_GROUND_TOKEN_NAMES.map(name => lightFlatSurface(name, 'night'));
  const walls = WORLD_WALL_TOKEN_NAMES.flatMap((name) => {
    return WALL_NORMALS.map(normal => lightFace(readWorldColor(name), 'night', normal));
  });

  return [...flat, ...walls];
};

const addGlowOnScreen = (surface: RgbaColorValue, glowName: string, strength: number): RgbaColorValue => {
  const glow = readWorldColor(glowName);

  return {
    alpha: 1,
    blue: Math.min(SCREEN_CHANNEL_MAX, surface.blue + glow.blue * strength),
    green: Math.min(SCREEN_CHANNEL_MAX, surface.green + glow.green * strength),
    red: Math.min(SCREEN_CHANNEL_MAX, surface.red + glow.red * strength),
  };
};

const readWorstContrast = (foreground: RgbaColorValue, backdrops: readonly RgbaColorValue[]): number => {
  return Math.min(...backdrops.map(backdrop => contrastRatio(foreground, backdrop)));
};

describe('world night glow', () => {
  it('declares every color of the night glow', () => {
    const missingNames = ['window-glass', ...WORLD_GLOW_TOKEN_NAMES].filter(name => !readWorldTokens().has(name));

    expect(missingNames).toEqual([]);
  });

  it('models the night ground exactly as the measured lit meadow', () => {
    const meadow = readScreenChannels(lightFlatSurface('ground', 'night'));

    expect(meadow.map(Math.round)).toEqual([0x3b, 0x52, 0x64]);
  });

  it.each(MEASURED_NIGHT_SURFACES)('models the night %s as the surface measured on the screenshot of the build', (name, measured) => {
    const modeled = readScreenChannels(lightFlatSurface(name, 'night'));

    modeled.forEach((channel, index) => {
      expect(Math.abs(channel - (measured[index] ?? 0))).toBeLessThanOrEqual(SCREEN_MODEL_TOLERANCE);
    });
  });

  it.each(['window-glow', 'lamp-glow'])('keeps %s at 3:1 on every surface lit by the night', (name) => {
    expect(readWorstContrast(readWorldColor(name), readNightSurfaces())).toBeGreaterThanOrEqual(GLOW_CONTRAST);
  });

  it('lights the lamp head brighter than the window', () => {
    expect(relativeLuminance(readWorldColor('lamp-glow'))).toBeGreaterThan(relativeLuminance(readWorldColor('window-glow')));
  });

  it('tells a lit window from a dark one', () => {
    expect(measureLuminanceContrast('window-glow', 'window-glass')).toBeGreaterThanOrEqual(WINDOW_SWITCH_CONTRAST);
  });

  it('keeps the dark window glass visible on the walls by day', () => {
    const dayWalls = WORLD_WALL_TOKEN_NAMES.flatMap((name) => {
      return WALL_NORMALS.map(normal => lightFace(readWorldColor(name), 'day', normal));
    });

    expect(readWorstContrast(readWorldColor('window-glass'), dayWalls)).toBeGreaterThanOrEqual(WINDOW_GLASS_DAY_CONTRAST);
  });

  it('keeps the dark window glass darker than the walls by night', () => {
    const nightWalls = WORLD_WALL_TOKEN_NAMES.flatMap((name) => {
      return WALL_NORMALS.map(normal => lightFace(readWorldColor(name), 'night', normal));
    });

    expect(readWorstContrast(readWorldColor('window-glass'), nightWalls)).toBeGreaterThanOrEqual(WINDOW_GLASS_NIGHT_CONTRAST);
  });

  it.each(WORLD_POOL_GROUND_TOKEN_NAMES)('lights the pool on the %s lighter than the surface and below the lamp head', (name) => {
    const surface = lightFlatSurface(name, 'night');
    const pooled = addGlowOnScreen(surface, 'light-pool', LIGHT_POOL_STRENGTH);

    expect(contrastRatio(pooled, surface)).toBeGreaterThanOrEqual(LIGHT_POOL_MIN_CONTRAST);
    expect(relativeLuminance(pooled)).toBeGreaterThan(relativeLuminance(surface));
    expect(relativeLuminance(pooled)).toBeLessThanOrEqual(LIGHT_POOL_MAX_LUMINANCE);
    expect(contrastRatio(readWorldColor('lamp-glow'), pooled)).toBeGreaterThanOrEqual(LAMP_OVER_POOL_CONTRAST);
  });

  it.each(WORLD_POOL_GROUND_TOKEN_NAMES)('keeps the pool on the %s warm as the shader adds it in screen sRGB', (name) => {
    const pooled = addGlowOnScreen(lightFlatSurface(name, 'night'), 'light-pool', LIGHT_POOL_STRENGTH);

    expect(pooled.red - pooled.blue).toBeGreaterThanOrEqual(POOL_WARM_MIN_RED_OVER_BLUE);
    expect(pooled.red - pooled.green).toBeGreaterThanOrEqual(POOL_WARM_MIN_RED_OVER_GREEN);
  });

  it.each(WORLD_POOL_GROUND_TOKEN_NAMES)('keeps the halo over the %s visible and weaker than the pool', (name) => {
    const surface = lightFlatSurface(name, 'night');
    const haloEdge = addGlowOnScreen(surface, 'light-pool', HALO_SHELL_STRENGTH);
    const haloCenter = addGlowOnScreen(surface, 'light-pool', HALO_SHELL_STRENGTH * HALO_SHELL_COUNT);
    const pooled = addGlowOnScreen(surface, 'light-pool', LIGHT_POOL_STRENGTH);

    expect(contrastRatio(haloEdge, surface)).toBeGreaterThanOrEqual(HALO_MIN_CONTRAST);
    expect(relativeLuminance(haloCenter)).toBeLessThan(relativeLuminance(pooled));
  });

  it.each(WORLD_OPEN_GROUND_TOKEN_NAMES)('keeps the road by night darker than the %s with a visible step', (ground) => {
    const road = lightFlatSurface('road', 'night');
    const surface = lightFlatSurface(ground, 'night');

    expect(relativeLuminance(road)).toBeLessThan(relativeLuminance(surface));
    expect(contrastRatio(road, surface)).toBeGreaterThanOrEqual(ROAD_NIGHT_CONTRAST);
  });
});

describe('world open ground by day', () => {
  it.each(MEASURED_DAY_SURFACES)('models the day %s as the surface measured on the screenshot of the build', (name, measured) => {
    const modeled = readScreenChannels(lightFlatSurface(name, 'day'));

    modeled.forEach((channel, index) => {
      expect(Math.abs(channel - (measured[index] ?? 0))).toBeLessThanOrEqual(SCREEN_MODEL_TOLERANCE);
    });
  });

  it.each(DAY_OPEN_GROUND_TOKEN_NAMES)('keeps the %s by day no lighter than its token by more than 3.2 percent', (name) => {
    const token = readWorldColor(name);
    const lit = lightFlatSurface(name, 'day');
    const lightening = Math.max(lit.red / token.red, lit.green / token.green, lit.blue / token.blue) - 1;

    expect(lightening).toBeLessThanOrEqual(DAY_OPEN_GROUND_LIGHTENING_LIMIT);
  });
});

describe('world selection corners without lighting', () => {
  it.each(WORLD_CORNER_GROUND_TOKEN_NAMES)('holds 3:1 on the %s by day with the better of the two layers', (name) => {
    const surface = lightFlatSurface(name, 'day');
    const better = Math.max(
      contrastRatio(readWorldColor('side-rim'), surface),
      contrastRatio(readWorldColor('road'), surface),
    );

    expect(better).toBeGreaterThanOrEqual(CORNER_GROUND_CONTRAST);
  });

  it.each(WORLD_CORNER_GROUND_TOKEN_NAMES)('holds 3:1 on the %s by night with the light layer', (name) => {
    const surface = lightFlatSurface(name, 'night');

    expect(contrastRatio(readWorldColor('side-rim'), surface)).toBeGreaterThanOrEqual(CORNER_GROUND_CONTRAST);
  });

  it('keeps the light layer apart from the dark one', () => {
    expect(measureLuminanceContrast('side-rim', 'road')).toBeGreaterThanOrEqual(CORNER_LAYERS_CONTRAST);
  });

  it('holds the white rim of a chip against every lit surface by night', () => {
    expect(readWorstContrast(readWorldColor('side-rim'), readNightSurfaces())).toBeGreaterThanOrEqual(RIM_NIGHT_CONTRAST);
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

const readSelectedRowBackdrop = (theme: ThemeNameValue): RgbaColorValue => {
  return compositeOver(readColor(theme, 'hover'), readColor(theme, 'panel-solid'));
};

const readPressedRowBackdrop = (theme: ThemeNameValue): RgbaColorValue => {
  return compositeOver(readColor(theme, 'line'), readColor(theme, 'panel-solid'));
};

describe('verification badge contrast', () => {
  it.each(THEME_NAMES)('keeps the ring of a badge visible on a selected and a pressed row in the %s theme', (theme) => {
    const ratio = readWorstRatio(
      readColor(theme, 'line-strong'),
      [readSelectedRowBackdrop(theme), readPressedRowBackdrop(theme)],
    );

    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_THRESHOLD);
  });

  it.each(THEME_NAMES)('keeps the text of an unverified badge readable on a selected and a pressed row in the %s theme', (theme) => {
    const ratio = readWorstRatio(
      readColor(theme, 'on-panel-muted'),
      [readSelectedRowBackdrop(theme), readPressedRowBackdrop(theme)],
    );

    expect(ratio).toBeGreaterThanOrEqual(TEXT_THRESHOLD);
  });

  it.each(THEME_NAMES)('keeps the glyph of the top level badge readable on its fill in the %s theme', (theme) => {
    const ratio = contrastRatio(readColor(theme, 'panel-solid'), readColor(theme, 'on-panel'));

    expect(ratio).toBeGreaterThanOrEqual(TEXT_THRESHOLD);
  });

  it.each(THEME_NAMES)('keeps the fill of the top level badge apart from the panel and a selected row in the %s theme', (theme) => {
    const backdrops = [
      readColor(theme, 'panel-solid'),
      readSelectedRowBackdrop(theme),
      ...readPanelBackdrops(theme),
    ];
    const ratio = readWorstRatio(readColor(theme, 'on-panel'), backdrops);

    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_THRESHOLD);
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
