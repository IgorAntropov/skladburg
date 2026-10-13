import { use } from 'react';

import type { SceneInsetsValue } from './sceneInsetsTypes';

import { SceneInsetsContext } from './SceneInsetsContext';

export const useSceneInsets = (): SceneInsetsValue => use(SceneInsetsContext);
