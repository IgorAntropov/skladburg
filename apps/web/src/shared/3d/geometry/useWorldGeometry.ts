import type { BufferGeometry } from 'three';

import { use } from 'react';

import type { WorldGeometryKeyValue } from './createWorldGeometryRegistry';

import { WorldGeometryContext } from './WorldGeometryContext';

export const useWorldGeometry = (key: WorldGeometryKeyValue): BufferGeometry => {
  const registry = use(WorldGeometryContext);

  if (registry === undefined) {
    throw new Error('World geometries are available only inside WorldGeometryProvider');
  }

  return registry.get(key);
};
