import {
  BufferAttribute,
  BufferGeometry,
} from 'three';

import type { NetworkSceneRoadValue } from '../layout';

import { ROAD_WIDTH_METERS } from '../layout';
import { buildRoadStrips } from './buildRoadStrips';
import { ROAD_HEIGHT_METERS } from './networkSceneMetrics';

const VECTOR_ITEM_SIZE = 3;

export const createRoadGeometry = (roads: readonly NetworkSceneRoadValue[]): BufferGeometry => {
  const { indices, normals, positions } = buildRoadStrips(roads, ROAD_WIDTH_METERS, ROAD_HEIGHT_METERS);
  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(positions, VECTOR_ITEM_SIZE));
  geometry.setAttribute('normal', new BufferAttribute(normals, VECTOR_ITEM_SIZE));
  geometry.setIndex(new BufferAttribute(indices, 1));

  return geometry;
};
