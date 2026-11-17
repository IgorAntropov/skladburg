import type { ReactElement } from 'react';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  RepeatWrapping,
  RGBAFormat,
} from 'three';

import type {
  WorldPaletteValue,
  WorldTerrainValue,
} from '@/shared/3d';

import { useWorldPalette } from '@/shared/3d';

import { toCssColor } from '../banner/siteBannerColors';

const FIELD_TEXTURE_WIDTH = 128;
const FIELD_TEXTURE_HEIGHT = 64;
const FURROW_REPEAT_METERS = 3.2;
const ROW_REPEAT_METERS = 9;
const LAND_BRIGHTNESS = 1.045;
const CHANNEL_MAX = 255;
const LAND_KEYS = ['ground', 'groundAlt', 'field', 'fieldAlt', 'sand'] as const;
const TAU = 2 * Math.PI;

interface FieldsGeometryValue {
  geometry: BufferGeometry;
  sourceVertices: readonly number[];
}

const createFurrows = (): DataTexture => {
  const bytes = new Uint8Array(FIELD_TEXTURE_WIDTH * FIELD_TEXTURE_HEIGHT * 4);

  for (let row = 0; row < FIELD_TEXTURE_HEIGHT; row += 1) {
    const z = row / FIELD_TEXTURE_HEIGHT * TAU;

    for (let column = 0; column < FIELD_TEXTURE_WIDTH; column += 1) {
      const x = column / FIELD_TEXTURE_WIDTH * TAU;
      const furrow = (1 + Math.cos(x * 5 + Math.sin(z) * 0.42)) / 2;
      const rowDetail = (Math.sin(x * 13 + z * 31) + Math.cos(x * 17 - z * 21)) * 1.3;
      const index = (row * FIELD_TEXTURE_WIDTH + column) * 4;

      bytes.fill(Math.min(CHANNEL_MAX, Math.round(254 - 40 * furrow ** 3 + rowDetail)), index, index + 3);
      bytes[index + 3] = CHANNEL_MAX;
    }
  }

  const texture = new DataTexture(bytes, FIELD_TEXTURE_WIDTH, FIELD_TEXTURE_HEIGHT, RGBAFormat);

  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;

  return texture;
};

const createFieldsGeometry = (terrain: WorldTerrainValue): FieldsGeometryValue => {
  const { groundGroups, groundIndex, groundPositions } = terrain;
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const sourceVertices: number[] = [];
  const vertexMap = new Map<number, number>();

  for (const { count, key, start } of groundGroups) {
    if (key !== 'field' && key !== 'fieldAlt') {
      continue;
    }

    const [normalX, normalZ] = key === 'field' ? [0.53, 0.85] : [0.89, -0.45];

    for (const vertex of groundIndex.subarray(start, start + count)) {
      let index = vertexMap.get(vertex);

      if (index === undefined) {
        const x = groundPositions[vertex * 3] ?? 0;
        const y = groundPositions[vertex * 3 + 1] ?? 0;
        const z = groundPositions[vertex * 3 + 2] ?? 0;

        index = sourceVertices.length;
        vertexMap.set(vertex, index);
        sourceVertices.push(vertex);
        positions.push(x, y, z);
        uvs.push((x * normalX + z * normalZ) / FURROW_REPEAT_METERS, (x * normalZ - z * normalX) / ROW_REPEAT_METERS);
      }

      indices.push(index);
    }
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(Float32Array.from(uvs), 2));
  geometry.setAttribute('color', new BufferAttribute(new Uint8Array(positions.length), 3, true));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  return { geometry, sourceVertices };
};

const paintFields = ({ geometry, sourceVertices }: FieldsGeometryValue, weights: Uint8Array, palette: WorldPaletteValue): void => {
  const paletteColors = LAND_KEYS.map(key => new Color(toCssColor(palette[key])).multiplyScalar(LAND_BRIGHTNESS));
  const colors = geometry.getAttribute('color');

  for (const [index, vertex] of sourceVertices.entries()) {
    let red = 0;
    let green = 0;
    let blue = 0;

    for (const [channel, { b, g, r }] of paletteColors.entries()) {
      const weight = weights[vertex * LAND_KEYS.length + channel] ?? 0;

      red += weight * r;
      green += weight * g;
      blue += weight * b;
    }

    colors.setXYZ(
      index,
      Math.min(CHANNEL_MAX, Math.round(red)) / CHANNEL_MAX,
      Math.min(CHANNEL_MAX, Math.round(green)) / CHANNEL_MAX,
      Math.min(CHANNEL_MAX, Math.round(blue)) / CHANNEL_MAX,
    );
  }

  colors.needsUpdate = true;
};

const skipRaycast = (): undefined => undefined;

export const NetworkFields = ({ terrain }: { terrain: WorldTerrainValue }): ReactElement => {
  const palette = useWorldPalette();
  const fields = useMemo(() => createFieldsGeometry(terrain), [terrain]);
  const furrows = useMemo(() => createFurrows(), []);
  const material = useMemo(
    () => new MeshStandardMaterial({ flatShading: true, map: furrows, roughness: 1, vertexColors: true }),
    [furrows],
  );

  useLayoutEffect(() => {
    paintFields(fields, terrain.groundWeights, palette);
  }, [fields, palette, terrain.groundWeights]);

  useEffect(() => () => {
    fields.geometry.dispose();
  }, [fields]);
  useEffect(() => () => {
    furrows.dispose();
    material.dispose();
  }, [furrows, material]);

  return <mesh frustumCulled={false} geometry={fields.geometry} material={material} raycast={skipRaycast} receiveShadow />;
};
