import type { WebGLRenderer } from 'three';

import { useThree } from '@react-three/fiber';
import { useCallback } from 'react';

export const markShadowMapStale = (renderer: Pick<WebGLRenderer, 'shadowMap'>): void => {
  renderer.shadowMap.needsUpdate = true;
};

export const useShadowMapRefresh = (): () => void => {
  const gl = useThree(state => state.gl);
  const invalidate = useThree(state => state.invalidate);

  return useCallback((): void => {
    markShadowMapStale(gl);
    invalidate();
  }, [gl, invalidate]);
};
