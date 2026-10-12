import type { ReactElement } from 'react';

import { StatsGl } from '@react-three/drei';

const STATS_CLASS_NAME = 'fixed top-[calc(var(--top-bar-row-min-height)+1rem)] left-2 z-50 flex';

const SceneDevStats = (): ReactElement => {
  return <StatsGl className={STATS_CLASS_NAME} horizontal trackGPU />;
};

export default SceneDevStats;
