import type { RgbaColorValue } from '@/shared/lib/color';

export const WORLD_PALETTE_KEYS = {
  background: '--world-background',
  board: '--world-board',
  boardEdge: '--world-board-edge',
  groundDay: '--world-ground-day',
  skyDay: '--world-sky-day',
  sunDay: '--world-sun-day',
  tile: '--world-tile',
  tileSeam: '--world-tile-seam',
} as const;

export type WorldPaletteKeyValue = keyof typeof WORLD_PALETTE_KEYS;

export type WorldPaletteValue = Readonly<Record<WorldPaletteKeyValue, RgbaColorValue>>;
