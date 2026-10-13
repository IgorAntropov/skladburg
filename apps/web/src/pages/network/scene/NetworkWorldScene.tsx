import type { ReactElement } from 'react';

import type { SceneWorldValue } from '@/shared/3d';

import {
  createSquareWorld,
  FlatGround,
  WORLD_SIZE_METERS,
} from '@/shared/3d';

export const world: SceneWorldValue = createSquareWorld(WORLD_SIZE_METERS);

const NetworkWorldScene = (): ReactElement => {
  return <FlatGround world={world} />;
};

export default NetworkWorldScene;
