import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  IcosahedronGeometry,
} from 'three';

import {
  LAMP_HALO_SHELL_RADII_METERS,
  LAMP_POOL_DISC_RADII_METERS,
} from '../night';

export const LAMP_POOL_DISC_SEGMENTS = 16;
export const LAMP_HALO_DETAIL = 1;

const MERGED_ATTRIBUTES = ['position', 'normal'] as const;
const ATTRIBUTE_ITEM_SIZE = 3;

const mergeAttribute = (geometries: readonly BufferGeometry[], name: typeof MERGED_ATTRIBUTES[number]): BufferAttribute => {
  const length = geometries.reduce((sum, geometry) => sum + geometry.getAttribute(name).array.length, 0);
  const values = new Float32Array(length);
  let offset = 0;

  for (const geometry of geometries) {
    const { array } = geometry.getAttribute(name);

    values.set(array, offset);
    offset += array.length;
  }

  return new BufferAttribute(values, ATTRIBUTE_ITEM_SIZE);
};

const mergeIndices = (geometries: readonly BufferGeometry[]): number[] => {
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const geometry of geometries) {
    for (const index of geometry.index?.array ?? []) {
      indices.push(index + vertexOffset);
    }

    vertexOffset += geometry.getAttribute('position').count;
  }

  return indices;
};

const mergeSolids = (geometries: readonly BufferGeometry[]): BufferGeometry => {
  const merged = new BufferGeometry();

  for (const name of MERGED_ATTRIBUTES) {
    merged.setAttribute(name, mergeAttribute(geometries, name));
  }

  if (geometries.every(geometry => geometry.index !== null)) {
    merged.setIndex(mergeIndices(geometries));
  }

  for (const geometry of geometries) {
    geometry.dispose();
  }

  return merged;
};

export const createLampPoolGeometry = (radii: readonly number[] = LAMP_POOL_DISC_RADII_METERS): BufferGeometry =>
  mergeSolids(radii.map(radius => new CircleGeometry(radius, LAMP_POOL_DISC_SEGMENTS).rotateX(-Math.PI / 2)));

export const createLampHaloGeometry = (radii: readonly number[] = LAMP_HALO_SHELL_RADII_METERS): BufferGeometry =>
  mergeSolids(radii.map(radius => new IcosahedronGeometry(radius, LAMP_HALO_DETAIL)));
