import type { BufferGeometry } from 'three';

import {
  ExtrudeGeometry,
  Float32BufferAttribute,
  MathUtils,
  Shape,
} from 'three';

export interface BeveledGableOptionsValue {
  bevel: number;
  eaveShade: number;
  segments: number;
  shadeHeight: number;
}

const HALF_SIZE = 0.5;
const COLOR_ITEM_SIZE = 3;

const createSection = (): Shape => {
  const shape = new Shape();

  shape.moveTo(-HALF_SIZE, 0);
  shape.lineTo(HALF_SIZE, 0);
  shape.lineTo(0, 1);
  shape.closePath();

  return shape;
};

export const createBeveledGableGeometry = ({
  bevel,
  eaveShade,
  segments,
  shadeHeight,
}: BeveledGableOptionsValue): BufferGeometry => {
  const geometry = new ExtrudeGeometry(createSection(), {
    bevelEnabled: true,
    bevelOffset: -bevel,
    bevelSegments: segments,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 1,
    depth: 1 - 2 * bevel,
    steps: 1,
  });

  geometry.translate(0, 0, bevel - HALF_SIZE);
  geometry.rotateY(Math.PI / 2);
  geometry.deleteAttribute('uv');

  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * COLOR_ITEM_SIZE);

  for (let index = 0; index < position.count; index += 1) {
    const shade = MathUtils.lerp(eaveShade, 1, MathUtils.smoothstep(position.getY(index), 0, shadeHeight));

    colors.fill(shade, index * COLOR_ITEM_SIZE, (index + 1) * COLOR_ITEM_SIZE);
  }

  geometry.setAttribute('color', new Float32BufferAttribute(colors, COLOR_ITEM_SIZE));

  return geometry;
};
