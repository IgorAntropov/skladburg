import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';

import type { RgbaColorValue } from '@/shared/lib/color';

import { setSceneBackground } from '../world/setSceneBackground';

interface SceneBackgroundProps {
  color: RgbaColorValue;
}

export const SceneBackground = ({ color }: SceneBackgroundProps): null => {
  const scene = useThree(state => state.scene);
  const invalidate = useThree(state => state.invalidate);

  useLayoutEffect(() => {
    setSceneBackground(scene, color);
    invalidate();

    return () => {
      setSceneBackground(scene, undefined);
    };
  }, [color, invalidate, scene]);

  return null;
};
