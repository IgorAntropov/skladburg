import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

import type { TerrainTreeShapeValue } from '../terrain/terrainDecorShapes';

import { TERRAIN_DECOR_SHAPES } from '../terrain/terrainDecorShapes';

const TRUNK_RADIAL_SEGMENTS = 5;
const TRUNK_TOP_RADIUS_RATIO = 0.7;
const CONIFER_RADIAL_SEGMENTS = 6;
const CROWN_DETAIL = 0;
const ROCK_DETAIL = 0;

const toSharedVertices = (geometry: BufferGeometry): BufferGeometry => {
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');

  return mergeVertices(geometry);
};

const createTrunk = (shape: TerrainTreeShapeValue): BufferGeometry => {
  const geometry = new CylinderGeometry(
    shape.trunkRadius * TRUNK_TOP_RADIUS_RATIO,
    shape.trunkRadius,
    shape.trunkHeight,
    TRUNK_RADIAL_SEGMENTS,
    1,
    true,
  );

  return toSharedVertices(geometry.translate(0, shape.trunkHeight / 2, 0));
};

export const createDeciduousTrunk = (): BufferGeometry => createTrunk(TERRAIN_DECOR_SHAPES.deciduous);

export const createConiferTrunk = (): BufferGeometry => createTrunk(TERRAIN_DECOR_SHAPES.conifer);

export const createDeciduousCrown = (): BufferGeometry => {
  const shape = TERRAIN_DECOR_SHAPES.deciduous;

  return toSharedVertices(new IcosahedronGeometry(shape.crownRadius, CROWN_DETAIL).translate(0, shape.crownCenterHeight, 0));
};

export const createConiferCrown = (): BufferGeometry => {
  const shape = TERRAIN_DECOR_SHAPES.conifer;

  return toSharedVertices(
    new ConeGeometry(shape.crownRadius, shape.crownHeight, CONIFER_RADIAL_SEGMENTS, 1, true)
      .translate(0, shape.crownBaseHeight + shape.crownHeight / 2, 0),
  );
};

export const createRock = (): BufferGeometry => toSharedVertices(new IcosahedronGeometry(TERRAIN_DECOR_SHAPES.rock.radius, ROCK_DETAIL));
