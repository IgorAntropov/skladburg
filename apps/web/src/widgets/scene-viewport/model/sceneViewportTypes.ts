import type { ComponentType } from 'react';

import type {
  SceneBoundsValue,
  SceneViewBoxValue,
} from '@/shared/3d';

export interface SceneModuleValue {
  bounds: SceneBoundsValue;
  default: ComponentType;
  viewBox: SceneViewBoxValue;
}
