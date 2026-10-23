import type { WorldPaletteValue } from '@/shared/3d';

import type { WorldModelGroupValue } from './worldModelCatalog';

import { WORLD_MODEL_ROLES } from './format/worldModelFormat';
import { WORLD_MODEL_ROLE_KEYS } from './worldModelRoleKeys';

export const WORLD_MODEL_PALETTE_PIXEL_BYTES = 4;

const OPAQUE_ALPHA = 255;

const toByte = (channel: number): number => Math.min(OPAQUE_ALPHA, Math.max(0, Math.round(channel)));

export const buildWorldModelPalettePixels = (group: WorldModelGroupValue, palette: WorldPaletteValue): Uint8Array => {
  const pixels = new Uint8Array(WORLD_MODEL_ROLES.length * WORLD_MODEL_PALETTE_PIXEL_BYTES);

  for (const [index, role] of WORLD_MODEL_ROLES.entries()) {
    const color = palette[WORLD_MODEL_ROLE_KEYS[group][role]];
    const offset = index * WORLD_MODEL_PALETTE_PIXEL_BYTES;

    pixels[offset] = toByte(color.red);
    pixels[offset + 1] = toByte(color.green);
    pixels[offset + 2] = toByte(color.blue);
    pixels[offset + 3] = OPAQUE_ALPHA;
  }

  return pixels;
};
