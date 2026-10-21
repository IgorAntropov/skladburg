import {
  ExtrudeGeometry,
  Shape,
} from 'three';

import type { SideShapeValue } from '@/entities/organization';

import {
  CHIP_BODY_DEPTH_METERS,
  CHIP_BODY_SIZE_METERS,
  CHIP_RIM_DEPTH_METERS,
  CHIP_RIM_FRONT_SETBACK_METERS,
  CHIP_RIM_SCALE,
} from './networkSceneMetrics';

const SQUARE_CENTER = 0.5;

export interface ChipGeometriesValue {
  body: ExtrudeGeometry;
  rim: ExtrudeGeometry;
}

const createExtrusion = (
  outline: SideShapeValue['outline'],
  scale: number,
  depth: number,
  frontZ: number,
): ExtrudeGeometry => {
  const shape = new Shape();

  for (const [index, point] of outline.entries()) {
    const x = (point[0] - SQUARE_CENTER) * scale * CHIP_BODY_SIZE_METERS;
    const y = (SQUARE_CENTER - point[1]) * scale * CHIP_BODY_SIZE_METERS;

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

export const createChipGeometries = (outline: SideShapeValue['outline']): ChipGeometriesValue => ({
  body: createExtrusion(outline, 1, CHIP_BODY_DEPTH_METERS, CHIP_BODY_DEPTH_METERS),
  rim: createExtrusion(outline, CHIP_RIM_SCALE, CHIP_RIM_DEPTH_METERS, CHIP_BODY_DEPTH_METERS - CHIP_RIM_FRONT_SETBACK_METERS),
});
