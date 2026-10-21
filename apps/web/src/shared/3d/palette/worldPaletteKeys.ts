import type { RgbaColorValue } from '@/shared/lib/color';

export const WORLD_PALETTE_KEYS = {
  background: '--world-background',
  backgroundNight: '--world-background-night',
  buildingRoof: '--world-building-roof',
  buildingRoofAlt: '--world-building-roof-alt',
  buildingWall: '--world-building-wall',
  field: '--world-field',
  fieldAlt: '--world-field-alt',
  ground: '--world-ground',
  groundAlt: '--world-ground-alt',
  groundDay: '--world-ground-day',
  groundNight: '--world-ground-night',
  lampGlow: '--world-lamp-glow',
  lightPool: '--world-light-pool',
  moon: '--world-moon',
  plaza: '--world-plaza',
  road: '--world-road',
  rock: '--world-rock',
  sand: '--world-sand',
  sideCarrier: '--world-side-carrier',
  sideCustomer: '--world-side-customer',
  sideRim: '--world-side-rim',
  sideSupplier: '--world-side-supplier',
  skyDay: '--world-sky-day',
  skyNight: '--world-sky-night',
  skySunset: '--world-sky-sunset',
  sunDay: '--world-sun-day',
  sunSunset: '--world-sun-sunset',
  treeCrown: '--world-tree-crown',
  treeCrownDark: '--world-tree-crown-dark',
  treeTrunk: '--world-tree-trunk',
  warehouseRoof: '--world-warehouse-roof',
  warehouseWall: '--world-warehouse-wall',
  water: '--world-water',
  windowGlass: '--world-window-glass',
  windowGlow: '--world-window-glow',
} as const;

export type WorldPaletteKeyValue = keyof typeof WORLD_PALETTE_KEYS;

export type WorldPaletteValue = Readonly<Record<WorldPaletteKeyValue, RgbaColorValue>>;
