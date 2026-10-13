import type { BufferGeometry } from 'three';

import {
  createConiferCrown,
  createConiferTrunk,
  createDeciduousCrown,
  createDeciduousTrunk,
  createRock,
} from './createDecorGeometries';

export interface IWorldGeometryRegistry {
  dispose: () => void;
  get: (key: WorldGeometryKeyValue) => BufferGeometry;
}

export type WorldGeometryKeyValue = 'coniferCrown' | 'coniferTrunk' | 'deciduousCrown' | 'deciduousTrunk' | 'rock';

const GEOMETRY_FACTORIES: Readonly<Record<WorldGeometryKeyValue, () => BufferGeometry>> = {
  coniferCrown: createConiferCrown,
  coniferTrunk: createConiferTrunk,
  deciduousCrown: createDeciduousCrown,
  deciduousTrunk: createDeciduousTrunk,
  rock: createRock,
};

export const createWorldGeometryRegistry = (): IWorldGeometryRegistry => {
  const geometries = new Map<WorldGeometryKeyValue, BufferGeometry>();

  const get = (key: WorldGeometryKeyValue): BufferGeometry => {
    const existing = geometries.get(key);

    if (existing !== undefined) {
      return existing;
    }

    const geometry = GEOMETRY_FACTORIES[key]();
    geometries.set(key, geometry);

    return geometry;
  };

  const dispose = (): void => {
    geometries.forEach((geometry) => {
      geometry.dispose();
    });
  };

  return { dispose, get };
};
