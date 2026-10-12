import type { ReactElement } from 'react';

import type { SceneBoundsValue } from '@/shared/3d';

import { TiledFloor } from '@/shared/3d';

const BOARD_COLUMNS = 24;
const BOARD_ROWS = 16;

export const bounds: SceneBoundsValue = {
  maxX: BOARD_COLUMNS / 2,
  maxZ: BOARD_ROWS / 2,
  minX: -BOARD_COLUMNS / 2,
  minZ: -BOARD_ROWS / 2,
};

const NetworkBoardScene = (): ReactElement => {
  return <TiledFloor bounds={bounds} />;
};

export default NetworkBoardScene;
