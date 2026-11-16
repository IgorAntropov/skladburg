import {
  BufferAttribute,
  BufferGeometry,
} from 'three';

import {
  ROCK_OUTCROP,
  SPRUCE_CROWN,
  SPRUCE_CROWN_HIGH,
  SPRUCE_TRUNK,
} from './landscapeGeometryData';

export interface LandscapeGeometriesValue {
  detailedSpruceCrown: BufferGeometry;
  rock: BufferGeometry;
  spruceCrown: BufferGeometry;
  spruceTrunk: BufferGeometry;
}

interface LandscapeMeshValue {
  indices: number[];
  positions: number[];
}

const createGeometry = ({ indices, positions }: LandscapeMeshValue): BufferGeometry => {
  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);

  return geometry;
};

export const createLandscapeGeometries = (): LandscapeGeometriesValue => ({
  detailedSpruceCrown: createGeometry(SPRUCE_CROWN_HIGH),
  rock: createGeometry(ROCK_OUTCROP),
  spruceCrown: createGeometry(SPRUCE_CROWN),
  spruceTrunk: createGeometry(SPRUCE_TRUNK),
});
