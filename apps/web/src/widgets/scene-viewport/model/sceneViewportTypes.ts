import type { ComponentType } from 'react';

import type { SceneWorldValue } from '@/shared/3d';

export interface SceneModuleValue {
  default: ComponentType;
  world: SceneWorldValue;
}
