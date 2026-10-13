import type { RgbaColorValue } from '@/shared/lib/color';

export const WORLD_PALETTE_KEYS = {
  background: '--world-background',
  field: '--world-field',
  fieldAlt: '--world-field-alt',
  ground: '--world-ground',
  groundAlt: '--world-ground-alt',
  groundDay: '--world-ground-day',
  rock: '--world-rock',
  sand: '--world-sand',
  skyDay: '--world-sky-day',
  sunDay: '--world-sun-day',
  treeCrown: '--world-tree-crown',
  treeCrownDark: '--world-tree-crown-dark',
  treeTrunk: '--world-tree-trunk',
  water: '--world-water',
} as const;

export type WorldPaletteKeyValue = keyof typeof WORLD_PALETTE_KEYS;

export type WorldPaletteValue = Readonly<Record<WorldPaletteKeyValue, RgbaColorValue>>;
