import type { ExtrudeGeometry } from 'three';

import type { SideShapeValue } from '@/entities/organization';

import { createOutlineExtrusion } from './createOutlineExtrusion';
import {
  OWN_MARKER_DEPTH_METERS,
  OWN_MARKER_FRONT_METERS,
  OWN_MARKER_OUTLINE_DEPTH_METERS,
  OWN_MARKER_OUTLINE_FRONT_METERS,
  OWN_MARKER_OUTLINE_SIZE_METERS,
  OWN_MARKER_SIZE_METERS,
} from './networkSceneMetrics';

export interface OwnMarkerGeometriesValue {
  house: ExtrudeGeometry;
  outline: ExtrudeGeometry;
}

export const OWN_MARKER_OUTLINE_POINTS: SideShapeValue['outline'] = [
  [0.5, 0.03],
  [0.96, 0.43],
  [0.96, 0.92],
  [0.88, 1],
  [0.64, 1],
  [0.64, 0.58],
  [0.36, 0.58],
  [0.36, 1],
  [0.12, 1],
  [0.04, 0.92],
  [0.04, 0.43],
];

export const createOwnMarkerGeometries = (): OwnMarkerGeometriesValue => ({
  house: createOutlineExtrusion(
    OWN_MARKER_OUTLINE_POINTS,
    OWN_MARKER_SIZE_METERS,
    OWN_MARKER_DEPTH_METERS,
    OWN_MARKER_FRONT_METERS,
  ),
  outline: createOutlineExtrusion(
    OWN_MARKER_OUTLINE_POINTS,
    OWN_MARKER_OUTLINE_SIZE_METERS,
    OWN_MARKER_OUTLINE_DEPTH_METERS,
    OWN_MARKER_OUTLINE_FRONT_METERS,
  ),
});
