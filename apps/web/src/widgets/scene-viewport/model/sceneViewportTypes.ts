import type { ComponentType } from 'react';

import type {
  SceneContentProps,
  SceneWorldValue,
} from '@/shared/3d';

export interface SceneModuleValue<TData, TInteraction = undefined> {
  default: ComponentType<SceneContentProps<TData, TInteraction>>;
  prepare: (data: TData) => Promise<void>;
  resolveWorld: (data: TData) => SceneWorldValue;
}
