import type {
  DirectionalLight,
  WebGLRenderer,
} from 'three';

import { useThree } from '@react-three/fiber';
import { useCallback } from 'react';

export const markShadowMapStale = (renderer: Pick<WebGLRenderer, 'shadowMap'>): void => {
  renderer.shadowMap.needsUpdate = true;
};

export const releaseShadowMap = ({ shadow }: Pick<DirectionalLight, 'shadow'>): void => {
  shadow.dispose();
  shadow.map = null;
};

export const useShadowMapRefresh = (): () => void => {
  const gl = useThree(state => state.gl);
  const invalidate = useThree(state => state.invalidate);

  return useCallback((): void => {
    markShadowMapStale(gl);
    invalidate();
  }, [gl, invalidate]);
};
