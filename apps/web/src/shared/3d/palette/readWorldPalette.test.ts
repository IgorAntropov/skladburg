import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WorldPaletteKeyValue } from './worldPaletteKeys';

import { readWorldPalette } from './readWorldPalette';
import { WORLD_PALETTE_KEYS } from './worldPaletteKeys';

const PALETTE_KEYS: readonly WorldPaletteKeyValue[] = [
  'background',
  'backgroundNight',
  'bannerPlate',
  'bannerText',
  'buildingBrick',
  'buildingRoof',
  'buildingRoofAlt',
  'buildingWall',
  'field',
  'fieldAlt',
  'ground',
  'groundAlt',
  'groundDay',
  'groundNight',
  'lampGlow',
  'lightPool',
  'moon',
  'plaza',
  'road',
  'rock',
  'sand',
  'sideCarrier',
  'sideCustomer',
  'sideRim',
  'sideSupplier',
  'skyDay',
  'skyNight',
  'skySunset',
  'sunDay',
  'sunSunset',
  'treeCrown',
  'treeCrownDark',
  'treeTrunk',
  'warehouseRoof',
  'warehouseWall',
  'water',
  'windowGlass',
  'windowGlow',
];

const createProperties = (): Map<string, string> => {
  return new Map(PALETTE_KEYS.map((key, index): [string, string] => [WORLD_PALETTE_KEYS[key], `rgb(${String(index * 5)} 20 30)`]));
};

const createReader = (properties: Map<string, string>): ((name: string) => string) => {
  return (name: string): string => properties.get(name) ?? '';
};

describe('readWorldPalette', () => {
  it('reads every palette key from its variable', () => {
    const palette = readWorldPalette(createReader(createProperties()));

    expect(Object.keys(palette).sort()).toEqual(Object.keys(WORLD_PALETTE_KEYS).sort());
    expect(Object.keys(palette).sort()).toEqual([...PALETTE_KEYS].sort());
    PALETTE_KEYS.forEach((key, index) => {
      expect(palette[key]).toEqual({
        alpha: 1,
        blue: 30,
        green: 20,
        red: index * 5,
      });
    });
  });

  it('asks for the documented variable of each key', () => {
    const requestedNames: string[] = [];

    readWorldPalette((name) => {
      requestedNames.push(name);

      return 'rgb(1 2 3)';
    });

    expect(requestedNames.sort()).toEqual(Object.values(WORLD_PALETTE_KEYS).sort());
  });

  it('accepts values padded with whitespace as computed styles return them', () => {
    const properties = createProperties();
    properties.set(WORLD_PALETTE_KEYS.ground, '  rgb(1 2 3)  ');

    expect(readWorldPalette(createReader(properties)).ground).toEqual({
      alpha: 1,
      blue: 3,
      green: 2,
      red: 1,
    });
  });

  it.each(PALETTE_KEYS)('names the variable when the value of %s is missing', (key) => {
    const properties = createProperties();
    properties.delete(WORLD_PALETTE_KEYS[key]);

    expect(() => readWorldPalette(createReader(properties))).toThrow(WORLD_PALETTE_KEYS[key]);
  });

  it.each(PALETTE_KEYS)('names the variable when the value of %s is not a color', (key) => {
    const properties = createProperties();
    properties.set(WORLD_PALETTE_KEYS[key], 'not-a-color');

    expect(() => readWorldPalette(createReader(properties))).toThrow(WORLD_PALETTE_KEYS[key]);
  });
});
