import type { ComponentType } from 'react';

import type {
  SceneContentProps,
  SceneWorldValue,
} from '@/shared/3d';

export interface SceneModuleValue {
  default: ComponentType<SceneContentProps>;
  prepare: () => Promise<void>;
  world: SceneWorldValue;
}
