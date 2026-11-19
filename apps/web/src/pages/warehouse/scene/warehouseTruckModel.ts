import type { InstancedMesh } from 'three';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';

import type { WorldPaletteValue } from '@/shared/3d';

import { useWorldPalette } from '@/shared/3d';

import truck from './warehouseTruck.json';
import {
  WAREHOUSE_TRUCK_COLORS,
  WAREHOUSE_TRUCK_POSITION_SCALE,
} from './warehouseTruckDimensions';

export interface WarehouseTruckModelValue {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  onDockTruck?: ((lane: number, mesh: InstancedMesh | null) => void) | undefined;
  onParking?: ((mesh: InstancedMesh | null) => void) | undefined;
}

const CHANNEL_MAX = 255;

export const createWarehouseTruckGeometry = (): BufferGeometry => {
  const geometry = new BufferGeometry();
  const positions = Float32Array.from(truck.positions, value => value / WAREHOUSE_TRUCK_POSITION_SCALE);
  let previousIndex = 0;
  const indices = truck.indexDeltas.map((delta) => {
    previousIndex += delta;
    return previousIndex;
  });

  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(new Uint8Array(truck.colors.length * 3), 3, true));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  return geometry;
};

export const paintWarehouseTruckColors = (geometry: BufferGeometry, palette: WorldPaletteValue): void => {
  const colors = WAREHOUSE_TRUCK_COLORS.map((key) => {
    const { blue, green, red } = palette[key];

    return new Color().setRGB(red / CHANNEL_MAX, green / CHANNEL_MAX, blue / CHANNEL_MAX, SRGBColorSpace);
  });
  const vertexColors = geometry.getAttribute('color');

  for (const [vertex, part] of truck.colors.entries()) {
    const color = colors[part];

    if (color !== undefined) {
      vertexColors.setXYZ(vertex, color.r, color.g, color.b);
    }
  }

  vertexColors.needsUpdate = true;
};

export const useWarehouseTruckModel = (): WarehouseTruckModelValue => {
  const palette = useWorldPalette();
  const geometry = useMemo(() => createWarehouseTruckGeometry(), []);
  const material = useMemo(() => new MeshStandardMaterial({ flatShading: true, roughness: 0.9, vertexColors: true }), []);

  useLayoutEffect(() => {
    paintWarehouseTruckColors(geometry, palette);
  }, [geometry, palette]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return { geometry, material };
};
