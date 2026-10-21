import type { ExtrudeGeometry } from 'three';

import type { SideShapeValue } from '@/entities/organization';

import { createOutlineExtrusion } from './createOutlineExtrusion';
import {
  CHIP_BODY_DEPTH_METERS,
  CHIP_BODY_SIZE_METERS,
  CHIP_RIM_DEPTH_METERS,
  CHIP_RIM_FRONT_SETBACK_METERS,
  CHIP_RIM_SCALE,
} from './networkSceneMetrics';

export interface ChipGeometriesValue {
  body: ExtrudeGeometry;
  rim: ExtrudeGeometry;
}

export const createChipGeometries = (outline: SideShapeValue['outline']): ChipGeometriesValue => ({
  body: createOutlineExtrusion(outline, CHIP_BODY_SIZE_METERS, CHIP_BODY_DEPTH_METERS, CHIP_BODY_DEPTH_METERS),
  rim: createOutlineExtrusion(
    outline,
    CHIP_BODY_SIZE_METERS * CHIP_RIM_SCALE,
    CHIP_RIM_DEPTH_METERS,
    CHIP_BODY_DEPTH_METERS - CHIP_RIM_FRONT_SETBACK_METERS,
  ),
});
