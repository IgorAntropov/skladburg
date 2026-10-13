import type { RgbaColorValue } from '@/shared/lib/color';

export const WORLD_PALETTE_KEYS = {
  background: '--world-background',
  ground: '--world-ground',
  groundDay: '--world-ground-day',
  skyDay: '--world-sky-day',
  sunDay: '--world-sun-day',
} as const;

export type WorldPaletteKeyValue = keyof typeof WORLD_PALETTE_KEYS;

export type WorldPaletteValue = Readonly<Record<WorldPaletteKeyValue, RgbaColorValue>>;
