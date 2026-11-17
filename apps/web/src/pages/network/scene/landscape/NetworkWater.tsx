import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
} from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  RepeatWrapping,
  RGBAFormat,
} from 'three';

import type { WorldTerrainValue } from '@/shared/3d';

import { useWorldMaterial } from '@/shared/3d';

const SHALLOW_WIDTH_METERS = 5.5;
const RIPPLE_TILE_METERS = 27;
const RIPPLE_TEXTURE_SIZE = 128;
const TAU = Math.PI * 2;

const createRipples = (): DataTexture => {
  const data = new Uint8Array(RIPPLE_TEXTURE_SIZE ** 2 * 4);

  for (let row = 0; row < RIPPLE_TEXTURE_SIZE; row += 1) {
    const z = row / RIPPLE_TEXTURE_SIZE * TAU;

    for (let column = 0; column < RIPPLE_TEXTURE_SIZE; column += 1) {
      const x = column / RIPPLE_TEXTURE_SIZE * TAU;
      const swell = Math.cos(z * 4 + x + Math.sin(x * 2 - z) * 0.65);
      const crest = Math.max(0, Math.cos(z * 17 + x * 2 + Math.sin(x * 4 + z * 2) * 0.7)) ** 12;
      const dispersion = (1 + Math.cos(x * 3 - z * 5 + Math.sin(z * 3))) / 2;
      const offset = (row * RIPPLE_TEXTURE_SIZE + column) * 4;

      data.fill(Math.round(228 + 5 * swell + crest * dispersion * 22), offset, offset + 3);
      data[offset + 3] = 255;
    }
  }

  const texture = new DataTexture(data, RIPPLE_TEXTURE_SIZE, RIPPLE_TEXTURE_SIZE, RGBAFormat);

  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;

  return texture;
};

const createWaterGeometry = (terrain: WorldTerrainValue, firstIndex: number, count: number): BufferGeometry => {
  const { groundIndex, groundPositions } = terrain;
  const source = groundIndex.subarray(firstIndex, firstIndex + count);
  const waterLevel = groundPositions[(source[0] ?? 0) * 3 + 1];
  const coast: { x: number; z: number }[] = [];

  for (const vertex of new Set(groundIndex.subarray(0, firstIndex))) {
    const offset = vertex * 3;

    if (groundPositions[offset + 1] === waterLevel) {
      coast.push({ x: groundPositions[offset] ?? 0, z: groundPositions[offset + 2] ?? 0 });
    }
  }

  const vertexIndex = new Map<number, number>();
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices = new Uint32Array(source.length);
  const shallowWidthSquared = SHALLOW_WIDTH_METERS ** 2;

  source.forEach((vertex, index) => {
    let mapped = vertexIndex.get(vertex);

    if (mapped === undefined) {
      const x = groundPositions[vertex * 3] ?? 0;
      const z = groundPositions[vertex * 3 + 2] ?? 0;
      let distanceSquared = shallowWidthSquared;

      for (const point of coast) {
        const dx = x - point.x;

        if (Math.abs(dx) < SHALLOW_WIDTH_METERS) {
          distanceSquared = Math.min(distanceSquared, dx ** 2 + (z - point.z) ** 2);
        }
      }

      const depth = Math.sqrt(distanceSquared) / SHALLOW_WIDTH_METERS;
      const shallows = 1 - depth ** 2 * (3 - 2 * depth);

      mapped = vertexIndex.size;
      vertexIndex.set(vertex, mapped);
      positions.push(x, waterLevel ?? 0, z);
      colors.push(0.61 + 0.61 * shallows, 0.66 + 0.49 * shallows, 0.83 + 0.12 * shallows);
      uvs.push(x / RIPPLE_TILE_METERS, z / RIPPLE_TILE_METERS);
    }

    indices[index] = mapped;
  });

  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(Float32Array.from(colors), 3));
  geometry.setAttribute('uv', new BufferAttribute(Float32Array.from(uvs), 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();

  return geometry;
};

interface NetworkWaterProps {
  count: number;
  firstIndex: number;
  terrain: WorldTerrainValue;
}

export const NetworkWater = ({ count, firstIndex, terrain }: NetworkWaterProps): ReactElement => {
  const worldWater = useWorldMaterial('water');
  const geometry = useMemo(() => createWaterGeometry(terrain, firstIndex, count), [count, firstIndex, terrain]);
  const ripples = useMemo(() => createRipples(), []);
  const material = useMemo(() => {
    const surface = new MeshStandardMaterial({
      flatShading: true,
      map: ripples,
      roughness: 0.84,
      vertexColors: true,
    });

    surface.color = worldWater.color;

    return surface;
  }, [ripples, worldWater]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);
  useEffect(() => () => {
    ripples.dispose();
    material.dispose();
  }, [material, ripples]);

  return <mesh frustumCulled={false} geometry={geometry} material={material} />;
};
