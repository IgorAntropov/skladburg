import {
  ExtrudeGeometry,
  Shape,
} from 'three';

import type { SideShapeValue } from '@/entities/organization';

const SQUARE_CENTER = 0.5;

export const createOutlineExtrusion = (
  outline: SideShapeValue['outline'],
  sizeMeters: number,
  depth: number,
  frontZ: number,
): ExtrudeGeometry => {
  const shape = new Shape();

  for (const [index, point] of outline.entries()) {
    const x = (point[0] - SQUARE_CENTER) * sizeMeters;
    const y = (SQUARE_CENTER - point[1]) * sizeMeters;

    if (index === 0) {
      shape.moveTo(x, y);
    }
    else {
      shape.lineTo(x, y);
    }
  }

  shape.closePath();

  return new ExtrudeGeometry(shape, { bevelEnabled: false, depth }).translate(0, 0, frontZ - depth);
};
