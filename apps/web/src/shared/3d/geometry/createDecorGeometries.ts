import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

import type { TerrainTreeShapeValue } from '../terrain/terrainDecorShapes';

import { TERRAIN_DECOR_SHAPES } from '../terrain/terrainDecorShapes';

const TRUNK_RADIAL_SEGMENTS = 5;
const TRUNK_TOP_RADIUS_RATIO = 0.7;
const CONIFER_RADIAL_SEGMENTS = 5;
const CROWN_DETAIL = 0;
const ROCK_DETAIL = 0;

const toSharedVertices = (geometry: BufferGeometry): BufferGeometry => {
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');

  const shared = mergeVertices(geometry);
  geometry.dispose();

  return shared;
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

  const geometry = new IcosahedronGeometry(shape.crownRadius, CROWN_DETAIL);
  const position = geometry.getAttribute('position');

  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const x = position.getX(vertex);
    const y = position.getY(vertex);
    const z = position.getZ(vertex);
    const spread = 1.08 + 0.13 * y;

    position.setXYZ(vertex, x * spread + 0.18 * y, shape.crownCenterHeight + y * 0.81, z * spread);
  }

  return toSharedVertices(geometry);
};

const createLayeredCrown = (hasExtraTier: boolean): BufferGeometry => {
  const shape = TERRAIN_DECOR_SHAPES.conifer;
  const sides = CONIFER_RADIAL_SEGMENTS;
  const rings = hasExtraTier
    ? [[1, shape.crownBaseHeight], [0.5, 1.88], [0.74, 1.98]]
    : [[1, shape.crownBaseHeight], [0.58, 1.75]];
  const positions: number[] = [];
  const indices: number[] = [];

  for (const [radius = 0, height = 0] of rings) {
    for (let side = 0; side < sides; side += 1) {
      const angle = side / sides * 2 * Math.PI;
      positions.push(Math.cos(angle) * radius + height * 0.035, height, Math.sin(angle) * radius);
    }
  }

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < sides; side += 1) {
      const first = ring * sides + side;
      const next = ring * sides + (side + 1) % sides;

      indices.push(first, first + sides, next, next, first + sides, next + sides);
    }
  }

  const tip = positions.length / 3;
  positions.push(0.28, shape.crownBaseHeight + shape.crownHeight, -0.12);

  for (let side = 0; side < sides; side += 1) {
    const ringStart = tip - sides;
    indices.push(ringStart + side, tip, ringStart + (side + 1) % sides);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);

  return geometry;
};

export const createConiferCrown = (): BufferGeometry => createLayeredCrown(false);

export const createDetailedConiferCrown = (): BufferGeometry => createLayeredCrown(true);

export const createRock = (): BufferGeometry => toSharedVertices(new IcosahedronGeometry(TERRAIN_DECOR_SHAPES.rock.radius, ROCK_DETAIL));
