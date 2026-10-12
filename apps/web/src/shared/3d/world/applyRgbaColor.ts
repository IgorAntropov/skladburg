import type { Color } from 'three';

import { SRGBColorSpace } from 'three';

import type { RgbaColorValue } from '@/shared/lib/color';

const CHANNEL_MAX = 255;

export const applyRgbaColor = (target: Color, source: RgbaColorValue): Color => {
  return target.setRGB(source.red / CHANNEL_MAX, source.green / CHANNEL_MAX, source.blue / CHANNEL_MAX, SRGBColorSpace);
};
