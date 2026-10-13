import { createContext } from 'react';

import type { SceneInsetsValue } from './sceneInsetsTypes';

import { ZERO_SCENE_INSETS } from './sceneInsetsTypes';

export const SceneInsetsContext = createContext<SceneInsetsValue>(ZERO_SCENE_INSETS);
