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
    backgroundNight: readWorldColor(readProperty, WORLD_PALETTE_KEYS.backgroundNight),
    buildingBrick: readWorldColor(readProperty, WORLD_PALETTE_KEYS.buildingBrick),
    buildingRoof: readWorldColor(readProperty, WORLD_PALETTE_KEYS.buildingRoof),
    buildingRoofAlt: readWorldColor(readProperty, WORLD_PALETTE_KEYS.buildingRoofAlt),
    buildingWall: readWorldColor(readProperty, WORLD_PALETTE_KEYS.buildingWall),
    field: readWorldColor(readProperty, WORLD_PALETTE_KEYS.field),
    fieldAlt: readWorldColor(readProperty, WORLD_PALETTE_KEYS.fieldAlt),
    ground: readWorldColor(readProperty, WORLD_PALETTE_KEYS.ground),
    groundAlt: readWorldColor(readProperty, WORLD_PALETTE_KEYS.groundAlt),
    groundDay: readWorldColor(readProperty, WORLD_PALETTE_KEYS.groundDay),
    groundNight: readWorldColor(readProperty, WORLD_PALETTE_KEYS.groundNight),
    lampGlow: readWorldColor(readProperty, WORLD_PALETTE_KEYS.lampGlow),
    lightPool: readWorldColor(readProperty, WORLD_PALETTE_KEYS.lightPool),
    moon: readWorldColor(readProperty, WORLD_PALETTE_KEYS.moon),
    plaza: readWorldColor(readProperty, WORLD_PALETTE_KEYS.plaza),
    road: readWorldColor(readProperty, WORLD_PALETTE_KEYS.road),
    rock: readWorldColor(readProperty, WORLD_PALETTE_KEYS.rock),
    sand: readWorldColor(readProperty, WORLD_PALETTE_KEYS.sand),
    sideCarrier: readWorldColor(readProperty, WORLD_PALETTE_KEYS.sideCarrier),
    sideCustomer: readWorldColor(readProperty, WORLD_PALETTE_KEYS.sideCustomer),
    sideRim: readWorldColor(readProperty, WORLD_PALETTE_KEYS.sideRim),
    sideSupplier: readWorldColor(readProperty, WORLD_PALETTE_KEYS.sideSupplier),
    skyDay: readWorldColor(readProperty, WORLD_PALETTE_KEYS.skyDay),
    skyNight: readWorldColor(readProperty, WORLD_PALETTE_KEYS.skyNight),
    skySunset: readWorldColor(readProperty, WORLD_PALETTE_KEYS.skySunset),
    sunDay: readWorldColor(readProperty, WORLD_PALETTE_KEYS.sunDay),
    sunSunset: readWorldColor(readProperty, WORLD_PALETTE_KEYS.sunSunset),
    treeCrown: readWorldColor(readProperty, WORLD_PALETTE_KEYS.treeCrown),
    treeCrownDark: readWorldColor(readProperty, WORLD_PALETTE_KEYS.treeCrownDark),
    treeTrunk: readWorldColor(readProperty, WORLD_PALETTE_KEYS.treeTrunk),
    warehouseRoof: readWorldColor(readProperty, WORLD_PALETTE_KEYS.warehouseRoof),
    warehouseWall: readWorldColor(readProperty, WORLD_PALETTE_KEYS.warehouseWall),
    water: readWorldColor(readProperty, WORLD_PALETTE_KEYS.water),
    windowGlass: readWorldColor(readProperty, WORLD_PALETTE_KEYS.windowGlass),
    windowGlow: readWorldColor(readProperty, WORLD_PALETTE_KEYS.windowGlow),
  };
};
