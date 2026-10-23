import type { BufferGeometry } from 'three';

import {
  Float32BufferAttribute,
  MathUtils,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export interface BeveledBoxOptionsValue {
  bottomShade: number;
  radii: Readonly<{ x: number; y: number; z: number }>;
  segments: number;
  shadeHeight: number;
}

const SOURCE_RADIUS = 0.1;
const HALF_SIZE = 0.5;
const COLOR_ITEM_SIZE = 3;

export const createBeveledBoxGeometry = ({
  bottomShade,
  radii,
  segments,
  shadeHeight,
}: BeveledBoxOptionsValue): BufferGeometry => {
  const geometry = new RoundedBoxGeometry(1, 1, 1, segments, SOURCE_RADIUS);
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const colors = new Float32Array(position.count * COLOR_ITEM_SIZE);

  for (let index = 0; index < position.count; index += 1) {
    const x = Math.sign(position.getX(index)) * (HALF_SIZE - radii.x) + normal.getX(index) * radii.x;
    const y = Math.sign(position.getY(index)) * (HALF_SIZE - radii.y) + normal.getY(index) * radii.y + HALF_SIZE;
    const z = Math.sign(position.getZ(index)) * (HALF_SIZE - radii.z) + normal.getZ(index) * radii.z;
    const shade = MathUtils.lerp(bottomShade, 1, MathUtils.smoothstep(y, 0, shadeHeight));

    position.setXYZ(index, x, y, z);
    colors.fill(shade, index * COLOR_ITEM_SIZE, (index + 1) * COLOR_ITEM_SIZE);
  }

  geometry.setAttribute('color', new Float32BufferAttribute(colors, COLOR_ITEM_SIZE));
  geometry.deleteAttribute('uv');

  return geometry;
};
