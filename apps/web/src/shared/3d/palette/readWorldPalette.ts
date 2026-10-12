import type { RgbaColorValue } from '@/shared/lib/color';

import { parseCssColor } from '@/shared/lib/color';

import type { WorldPaletteValue } from './worldPaletteKeys';

import { WORLD_PALETTE_KEYS } from './worldPaletteKeys';

const readWorldColor = (readProperty: (name: string) => string, name: string): RgbaColorValue => {
  const rawValue = readProperty(name);
  const color = parseCssColor(rawValue);

  if (color === undefined) {
    throw new Error(`World palette variable ${name} is missing or is not a color: "${rawValue.trim()}"`);
  }

  return color;
};

export const readWorldPalette = (readProperty: (name: string) => string): WorldPaletteValue => {
  return {
    background: readWorldColor(readProperty, WORLD_PALETTE_KEYS.background),
    board: readWorldColor(readProperty, WORLD_PALETTE_KEYS.board),
    boardEdge: readWorldColor(readProperty, WORLD_PALETTE_KEYS.boardEdge),
    groundDay: readWorldColor(readProperty, WORLD_PALETTE_KEYS.groundDay),
    skyDay: readWorldColor(readProperty, WORLD_PALETTE_KEYS.skyDay),
    sunDay: readWorldColor(readProperty, WORLD_PALETTE_KEYS.sunDay),
    tile: readWorldColor(readProperty, WORLD_PALETTE_KEYS.tile),
    tileSeam: readWorldColor(readProperty, WORLD_PALETTE_KEYS.tileSeam),
  };
};
