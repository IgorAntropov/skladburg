import type { ReactElement } from 'react';

import type {
  SceneContentProps,
  SceneWorldValue,
} from '@/shared/3d';

import {
  createSquareWorld,
  EMPTY_TERRAIN_RESERVED,
  loadWorldTerrain,
  WORLD_SIZE_METERS,
  WorldTerrain,
} from '@/shared/3d';

import { NETWORK_WORLD_SEED } from './networkWorldConstants';

export const world: SceneWorldValue = createSquareWorld(WORLD_SIZE_METERS);

const terrainParams = {
  reserved: EMPTY_TERRAIN_RESERVED,
  seed: NETWORK_WORLD_SEED,
  world,
};

export const prepare = async (): Promise<void> => {
  await loadWorldTerrain(terrainParams);
};

const NetworkWorldScene = ({ level }: SceneContentProps): ReactElement => {
  const terrain = loadWorldTerrain.peek(terrainParams);

  if (terrain === undefined) {
    throw new Error('The network world terrain is not prepared');
  }

  return <WorldTerrain level={level} terrain={terrain} />;
};

export default NetworkWorldScene;
