import type { ComponentType } from 'react';

import type { SceneBoundsValue } from '@/shared/3d';

export interface SceneModuleValue {
  bounds: SceneBoundsValue;
  default: ComponentType;
}
