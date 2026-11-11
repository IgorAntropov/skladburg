import type { BufferGeometry } from 'three';

import { Color } from 'three';

import type { WorldPaletteValue } from '../palette/worldPaletteKeys';

import { applyRgbaColor } from '../world/applyRgbaColor';
import {
  TERRAIN_SURFACE_KEYS,
  TERRAIN_SURFACE_WATER,
} from './terrainConstants';
import { readNumber } from './terrainMath';

const LAND_BRIGHTNESS = 1.045;
const CHANNEL_RANGE = 255;

export const paintGroundGeometry = (geometry: BufferGeometry, weights: Uint8Array, palette: WorldPaletteValue): void => {
  const color = geometry.getAttribute('color');
  const values = color.array;
  const colors = TERRAIN_SURFACE_KEYS.slice(0, TERRAIN_SURFACE_WATER)
    .map(key => applyRgbaColor(new Color(), palette[key]).multiplyScalar(LAND_BRIGHTNESS));

  for (let vertex = 0; vertex < color.count; vertex += 1) {
    let red = 0;
    let green = 0;
    let blue = 0;

    for (let key = 0; key < colors.length; key += 1) {
      const weight = readNumber(weights, vertex * TERRAIN_SURFACE_WATER + key);
      const base = colors[key];

      if (weight > 0 && base !== undefined) {
        red += weight * base.r;
        green += weight * base.g;
        blue += weight * base.b;
      }
    }

    values[vertex * 3] = Math.min(CHANNEL_RANGE, Math.round(red));
    values[vertex * 3 + 1] = Math.min(CHANNEL_RANGE, Math.round(green));
    values[vertex * 3 + 2] = Math.min(CHANNEL_RANGE, Math.round(blue));
  }

  color.needsUpdate = true;
};
